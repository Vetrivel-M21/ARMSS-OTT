

package media

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// GetFFprobePath returns configured or auto-detected path to ffprobe executable.
func GetFFprobePath() string {
	if p := os.Getenv("FFPROBE_PATH"); p != "" {
		return p
	}
	for _, candidate := range []string{
		"bin/ffprobe.exe",
		"backend/bin/ffprobe.exe",
		"../backend/bin/ffprobe.exe",
		"../../bin/ffprobe.exe",
		"ffprobe",
	} {
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
	for _, candidate := range []string{
		"bin/ffmpeg.exe",
		"backend/bin/ffmpeg.exe",
		"../backend/bin/ffmpeg.exe",
		"../../bin/ffmpeg.exe",
		"ffmpeg",
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "ffmpeg"
}

// ProbeDuration uses ffprobe to get the exact duration of a media file in seconds.
func ProbeDuration(path string) (float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	ffprobeBin := GetFFprobePath()
	args := []string{
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=nw=1:nk=1",
		path,
	}

	cmd := exec.CommandContext(ctx, ffprobeBin, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return 0, fmt.Errorf("ffprobe duration failed on %s: %w | stderr: %s", path, err, strings.TrimSpace(stderr.String()))
	}

	outStr := strings.TrimSpace(stdout.String())
	if outStr == "" || outStr == "N/A" {
		return 0, fmt.Errorf("ffprobe returned empty or N/A duration for %s", path)
	}

	dur, err := strconv.ParseFloat(outStr, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing duration %q for %s: %w", outStr, path, err)
	}

	return dur, nil
}

// NormalizeMP4 runs: ffmpeg -y -i in -c copy -movflags +faststart out
// It moves the moov atom to the front and turns fragmented MP4s into standard faststart streamable MP4s.
func NormalizeMP4(inPath, outPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	ffmpegBin := GetFFmpegPath()
	args := []string{
		"-y",
		"-i", inPath,
		"-c", "copy",
		"-movflags", "+faststart",
		outPath,
	}

	cmd := exec.CommandContext(ctx, ffmpegBin, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if len(errMsg) > 2000 {
			errMsg = errMsg[len(errMsg)-2000:]
		}
		return fmt.Errorf("ffmpeg normalize failed: %w | stderr: %s", err, errMsg)
	}

	return nil
}

// AtomInfo represents a top-level box in an MP4 file.
type AtomInfo struct {
	Type   string
	Offset int64
	Size   uint64
}

// InspectTopLevelAtoms reads top-level MP4 atoms sequentially from an io.ReadSeeker.
func InspectTopLevelAtoms(r io.ReadSeeker) ([]AtomInfo, error) {
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	var atoms []AtomInfo
	var buf [8]byte
	var extBuf [8]byte

	for {
		offset, err := r.Seek(0, io.SeekCurrent)
		if err != nil {
			return nil, err
		}

		_, err = io.ReadFull(r, buf[:])
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}
		if err != nil {
			return nil, err
		}

		size := uint64(binary.BigEndian.Uint32(buf[0:4]))
		atomType := string(buf[4:8])

		if size == 1 {
			// 64-bit extended size
			if _, err := io.ReadFull(r, extBuf[:]); err != nil {
				break
			}
			size = binary.BigEndian.Uint64(extBuf[:])
			if size < 16 {
				break
			}
		} else if size == 0 {
			// Box extends to end of file
			atoms = append(atoms, AtomInfo{Type: atomType, Offset: offset, Size: 0})
			break
		} else if size < 8 {
			break
		}

		atoms = append(atoms, AtomInfo{Type: atomType, Offset: offset, Size: size})

		// Seek to next atom
		nextOffset := offset + int64(size)
		if _, err := r.Seek(nextOffset, io.SeekStart); err != nil {
			break
		}
	}

	return atoms, nil
}

// IsFragmentedOrNoFaststart detects if an MP4 file contains 'moof' fragments
// or if its 'moov' atom is placed AFTER 'mdat' (no faststart).
// Returns true if the file needs normalization.
func IsFragmentedOrNoFaststart(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	atoms, err := InspectTopLevelAtoms(f)
	if err != nil || len(atoms) == 0 {
		return false
	}

	var mdatOffset int64 = -1
	var moovOffset int64 = -1
	hasMoof := false

	for _, a := range atoms {
		if a.Type == "moof" {
			hasMoof = true
		}
		if a.Type == "mdat" && mdatOffset == -1 {
			mdatOffset = a.Offset
		}
		if a.Type == "moov" && moovOffset == -1 {
			moovOffset = a.Offset
		}
	}

	// 1. Fragmented MP4 has moof boxes -> Needs normalization
	if hasMoof {
		return true
	}

	// 2. If moov is absent or appears after mdat -> Needs normalization (not faststart)
	if moovOffset == -1 || (mdatOffset != -1 && moovOffset > mdatOffset) {
		return true
	}

	return false
}
