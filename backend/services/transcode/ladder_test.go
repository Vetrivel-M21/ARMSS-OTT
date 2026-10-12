package transcode

import (
	"strings"
	"testing"
)

func TestFilterLadder_4KSource(t *testing.T) {
	meta := VideoMetadata{
		Width:    3840,
		Height:   2160,
		FPS:      24.0,
		Duration: 60.0,
	}

	rungs := FilterLadder(meta)
	if len(rungs) != 5 {
		t.Fatalf("expected 5 rungs for 4K source, got %d", len(rungs))
	}

	expectedRungNames := []string{"2160p", "1080p", "720p", "480p", "360p"}
	for i, expected := range expectedRungNames {
		if rungs[i].Name != expected {
			t.Errorf("rung index %d: expected %s, got %s", i, expected, rungs[i].Name)
		}
	}
}

func TestFilterLadder_1080pSource(t *testing.T) {
	meta := VideoMetadata{
		Width:    1920,
		Height:   1080,
		FPS:      30.0,
		Duration: 120.0,
	}

	rungs := FilterLadder(meta)
	if len(rungs) != 4 {
		t.Fatalf("expected 4 rungs for 1080p source (2160p skipped), got %d", len(rungs))
	}

	// 2160p must be excluded
	for _, r := range rungs {
		if r.Name == "2160p" {
			t.Errorf("expected 2160p to be skipped for 1080p source, but found in ladder")
		}
	}

	if rungs[0].Name != "1080p" {
		t.Errorf("expected highest rung to be 1080p, got %s", rungs[0].Name)
	}
}

func TestFilterLadder_720pSource(t *testing.T) {
	meta := VideoMetadata{
		Width:    1280,
		Height:   720,
		FPS:      25.0,
		Duration: 45.0,
	}

	rungs := FilterLadder(meta)
	if len(rungs) != 3 {
		t.Fatalf("expected 3 rungs for 720p source, got %d", len(rungs))
	}

	expectedRungs := []string{"720p", "480p", "360p"}
	for i, exp := range expectedRungs {
		if rungs[i].Name != exp {
			t.Errorf("rung %d: expected %s, got %s", i, exp, rungs[i].Name)
		}
	}
}

func TestFilterLadder_LowResSource(t *testing.T) {
	meta := VideoMetadata{
		Width:    320,
		Height:   240,
		FPS:      25.0,
		Duration: 10.0,
	}

	rungs := FilterLadder(meta)
	if len(rungs) == 0 {
		t.Fatalf("expected at least 1 fallback rung for low res source, got 0")
	}
}

func TestBuildFFmpegHLSCommand_KeyframeAlignmentAndFlags(t *testing.T) {
	meta := VideoMetadata{
		Width:    3840,
		Height:   2160,
		FPS:      24.0, // 24 fps -> 2s GOP = 48
		Duration: 30.0,
	}

	rungs := FilterLadder(meta)
	args := BuildFFmpegHLSCommand("test_input.mp4", "/output/hls", meta, rungs)
	cmdStr := strings.Join(args, " ")

	// 1. Verify 2s GOP alignment flags
	if !containsArgPair(args, "-g", "48") {
		t.Errorf("expected '-g 48' for 24fps input (2s GOP), got cmd: %s", cmdStr)
	}
	if !containsArgPair(args, "-keyint_min", "48") {
		t.Errorf("expected '-keyint_min 48' for 24fps input, got cmd: %s", cmdStr)
	}
	if !containsArgPair(args, "-sc_threshold", "0") {
		t.Errorf("expected '-sc_threshold 0' to disable scene cut keyframes, got cmd: %s", cmdStr)
	}
	if !containsArgPair(args, "-force_key_frames", "expr:gte(t,n_forced*2)") {
		t.Errorf("expected forced keyframe expression every 2s, got cmd: %s", cmdStr)
	}

	// 2. Verify fMP4 CMAF and HLS segment options
	if !containsArgPair(args, "-f", "hls") {
		t.Errorf("expected -f hls")
	}
	if !containsArgPair(args, "-hls_time", "4") {
		t.Errorf("expected -hls_time 4 (4s segments)")
	}
	if !containsArgPair(args, "-hls_segment_type", "fmp4") {
		t.Errorf("expected -hls_segment_type fmp4 (CMAF fMP4)")
	}
	if !containsArgPair(args, "-master_pl_name", "master.m3u8") {
		t.Errorf("expected -master_pl_name master.m3u8")
	}

	// 3. Verify audio encoding (AAC 128k)
	if !strings.Contains(cmdStr, "-c:a:0 aac") || !strings.Contains(cmdStr, "-b:a:0 128k") {
		t.Errorf("expected AAC 128k audio settings in command: %s", cmdStr)
	}

	// 4. Verify 2160p 16 Mbps rung video bitrate
	if !strings.Contains(cmdStr, "-b:v:0 16000k") {
		t.Errorf("expected 16000k for 2160p rung in command: %s", cmdStr)
	}
}

func containsArgPair(args []string, flag, expectedVal string) bool {
	for i := 0; i < len(args)-1; i++ {
		if args[i] == flag && args[i+1] == expectedVal {
			return true
		}
	}
	return false
}
