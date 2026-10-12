package transcode

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// FFProbeOutput represents JSON output format from ffprobe.
type FFProbeOutput struct {
	Streams []struct {
		CodecType  string `json:"codec_type"`
		Width      int    `json:"width"`
		Height     int    `json:"height"`
		RFrameRate string `json:"r_frame_rate"`
		Duration   string `json:"duration"`
	} `json:"streams"`
	Format struct {
		Duration string `json:"duration"`
	} `json:"format"`
}

// GetFFprobePath returns configured or auto-detected path to ffprobe executable.
func GetFFprobePath() string {
	if p := os.Getenv("FFPROBE_PATH"); p != "" {
		return p
	}
	for _, candidate := range []string{"bin/ffprobe.exe", "backend/bin/ffprobe.exe", "../backend/bin/ffprobe.exe", "ffprobe"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "ffprobe"
}

// GetFFmpegPath returns configured or auto-detected path to ffmpeg executable.
func GetFFmpegPath() string {
	if p := os.Getenv("FFMPEG_PATH"); p != "" {
		return p
	}
	for _, candidate := range []string{"bin/ffmpeg.exe", "backend/bin/ffmpeg.exe", "../backend/bin/ffmpeg.exe", "ffmpeg"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "ffmpeg"
}

// ProbeVideo inspects an input video file using ffprobe to extract resolution, duration, and FPS.
func ProbeVideo(ctx context.Context, filePath string) (VideoMetadata, error) {
	cmdPath := GetFFprobePath()
	args := []string{
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height,r_frame_rate,duration",
		"-show_entries", "format=duration",
		"-of", "json",
		filePath,
	}

	execCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(execCtx, cmdPath, args...)
	output, err := cmd.Output()
	if err != nil {
		return VideoMetadata{}, fmt.Errorf("running ffprobe (%s): %w", cmdPath, err)
	}

	var probeData FFProbeOutput
	if err := json.Unmarshal(output, &probeData); err != nil {
		return VideoMetadata{}, fmt.Errorf("decoding ffprobe output: %w", err)
	}

	if len(probeData.Streams) == 0 {
		return VideoMetadata{}, fmt.Errorf("no video streams found in %s", filePath)
	}

	stream := probeData.Streams[0]
	fps := parseFrameRate(stream.RFrameRate)
	if fps <= 0 {
		fps = 25.0
	}

	duration := parseDuration(stream.Duration)
	if duration <= 0 {
		duration = parseDuration(probeData.Format.Duration)
	}

	meta := VideoMetadata{
		Width:    stream.Width,
		Height:   stream.Height,
		Duration: duration,
		FPS:      fps,
	}

	return meta, nil
}

func parseFrameRate(rateStr string) float64 {
	parts := strings.Split(rateStr, "/")
	if len(parts) == 2 {
		num, err1 := strconv.ParseFloat(parts[0], 64)
		den, err2 := strconv.ParseFloat(parts[1], 64)
		if err1 == nil && err2 == nil && den > 0 {
			return num / den
		}
	}
	val, err := strconv.ParseFloat(rateStr, 64)
	if err == nil {
		return val
	}
	return 25.0
}

func parseDuration(durStr string) float64 {
	val, err := strconv.ParseFloat(durStr, 64)
	if err == nil {
		return val
	}
	return 0
}
