package transcode

import (
	"fmt"
	"math"
	"strings"
)

// LadderRung represents a single quality rung in an ABR ladder.
type LadderRung struct {
	Name         string
	Width        int
	Height       int
	VideoBitrate int // in bits/sec, e.g. 16000000 for 16 Mbps
	MaxRate      int // in bits/sec
	BufSize      int // in bits/sec
	AudioBitrate int // in bits/sec, 128000 for 128k
	Profile      string
	Level        string
}

// StandardABRLadder defines the target HLS ABR ladder per specification.
var StandardABRLadder = []LadderRung{
	{
		Name:         "2160p",
		Width:        3840,
		Height:       2160,
		VideoBitrate: 16000000, // ~16 Mbps
		MaxRate:      17600000,
		BufSize:      24000000,
		AudioBitrate: 128000,
		Profile:      "high",
		Level:        "5.1",
	},
	{
		Name:         "1080p",
		Width:        1920,
		Height:       1080,
		VideoBitrate: 5000000, // ~5 Mbps
		MaxRate:      5500000,
		BufSize:      7500000,
		AudioBitrate: 128000,
		Profile:      "high",
		Level:        "4.1",
	},
	{
		Name:         "720p",
		Width:        1280,
		Height:       720,
		VideoBitrate: 2800000, // ~2.8 Mbps
		MaxRate:      3080000,
		BufSize:      4200000,
		AudioBitrate: 128000,
		Profile:      "main",
		Level:        "3.1",
	},
	{
		Name:         "480p",
		Width:        854,
		Height:       480,
		VideoBitrate: 1200000, // ~1.2 Mbps
		MaxRate:      1320000,
		BufSize:      1800000,
		AudioBitrate: 128000,
		Profile:      "main",
		Level:        "3.1",
	},
	{
		Name:         "360p",
		Width:        640,
		Height:       360,
		VideoBitrate: 600000, // ~0.6 Mbps
		MaxRate:      660000,
		BufSize:      900000,
		AudioBitrate: 128000,
		Profile:      "baseline",
		Level:        "3.0",
	},
}

// VideoMetadata contains probed metadata for a video.
type VideoMetadata struct {
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	Duration float64 `json:"duration"`
	FPS      float64 `json:"fps"`
}

// FilterLadder filters the standard ladder to skip any rung exceeding source resolution.
func FilterLadder(meta VideoMetadata) []LadderRung {
	var eligible []LadderRung
	for _, rung := range StandardABRLadder {
		// Skip rung if its resolution exceeds the source
		if rung.Width > meta.Width || rung.Height > meta.Height {
			continue
		}
		eligible = append(eligible, rung)
	}

	// If source is smaller than even the lowest ladder rung (360p), keep at least 360p scaled down
	if len(eligible) == 0 {
		lowest := StandardABRLadder[len(StandardABRLadder)-1]
		lowest.Width = meta.Width
		lowest.Height = meta.Height
		eligible = append(eligible, lowest)
	}
	return eligible
}

// BuildFFmpegHLSCommand generates the FFmpeg CLI arguments to transcode an input video
// into an adaptive fMP4 HLS ladder with aligned keyframes and master.m3u8.
func BuildFFmpegHLSCommand(inputPath, outputDir string, meta VideoMetadata, rungs []LadderRung) []string {
	fps := meta.FPS
	if fps <= 0 {
		fps = 25.0
	}

	// Fixed GOP every 2s: keyframe interval = 2 * fps
	gop := int(math.Round(fps * 2))
	if gop <= 0 {
		gop = 50
	}

	args := []string{
		"-y", // overwrite outputs
		"-i", inputPath,
	}

	// Build filter_complex: split video into N streams and scale each
	numRungs := len(rungs)
	var splitOutputs []string
	for i := 0; i < numRungs; i++ {
		splitOutputs = append(splitOutputs, fmt.Sprintf("[v%d]", i))
	}

	filterParts := []string{
		fmt.Sprintf("[0:v]split=%d%s", numRungs, strings.Join(splitOutputs, "")),
	}

	for i, r := range rungs {
		// Ensure width and height are even numbers for H.264
		w := (r.Width / 2) * 2
		h := (r.Height / 2) * 2
		filterParts = append(filterParts, fmt.Sprintf("[v%d]scale=w=%d:h=%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2[outv%d]",
			i, w, h, w, h, i))
	}
	filterComplex := strings.Join(filterParts, ";")

	args = append(args, "-filter_complex", filterComplex)

	// Build mapping, encoders, bitrates, GOP, and profiles for each rendition
	for i, r := range rungs {
		args = append(args,
			"-map", fmt.Sprintf("[outv%d]", i),
			"-map", "0:a:0?",
			fmt.Sprintf("-c:v:%d", i), "libx264",
			fmt.Sprintf("-b:v:%d", i), fmt.Sprintf("%dk", r.VideoBitrate/1000),
			fmt.Sprintf("-maxrate:v:%d", i), fmt.Sprintf("%dk", r.MaxRate/1000),
			fmt.Sprintf("-bufsize:v:%d", i), fmt.Sprintf("%dk", r.BufSize/1000),
			fmt.Sprintf("-profile:v:%d", i), r.Profile,
			fmt.Sprintf("-level:v:%d", i), r.Level,
			fmt.Sprintf("-c:a:%d", i), "aac",
			fmt.Sprintf("-b:a:%d", i), fmt.Sprintf("%dk", r.AudioBitrate/1000),
			fmt.Sprintf("-ar:%d", i), "48000",
			fmt.Sprintf("-ac:%d", i), "2",
		)
	}

	// Universal encoding parameters:
	// - Fixed GOP 2 seconds: -g <gop> -keyint_min <gop>
	// - Disable scene cut insertion: -sc_threshold 0
	// - Forced keyframes every 2s
	args = append(args,
		"-g", fmt.Sprintf("%d", gop),
		"-keyint_min", fmt.Sprintf("%d", gop),
		"-sc_threshold", "0",
		"-force_key_frames", "expr:gte(t,n_forced*2)",
		"-preset", "veryfast",
		"-f", "hls",
		"-hls_time", "4", // 4-second segment duration
		"-hls_playlist_type", "vod",
		"-hls_segment_type", "fmp4", // CMAF fMP4 segments
		"-hls_flags", "independent_segments",
		"-master_pl_name", "master.m3u8",
	)

	// Build var_stream_map: e.g. "v:0,a:0 v:1,a:1 v:2,a:2"
	var streamMaps []string
	for i := range rungs {
		streamMaps = append(streamMaps, fmt.Sprintf("v:%d,a:%d", i, i))
	}
	args = append(args, "-var_stream_map", strings.Join(streamMaps, " "))

	// Output format and pattern in destination directory
	segmentPattern := fmt.Sprintf("%s/stream_%%v_data%%05d.m4s", filepathToSlash(outputDir))
	playlistPattern := fmt.Sprintf("%s/stream_%%v.m3u8", filepathToSlash(outputDir))

	args = append(args,
		"-hls_segment_filename", segmentPattern,
		playlistPattern,
	)

	return args
}

func filepathToSlash(path string) string {
	return strings.ReplaceAll(path, "\\", "/")
}
