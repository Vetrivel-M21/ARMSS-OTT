package metrics

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMetricsRecordAndExpose(t *testing.T) {
	// Record some transcode events
	RecordTranscodeDuration(4*time.Second, true, "")
	RecordTranscodeDuration(12*time.Second, true, "")
	RecordTranscodeDuration(45*time.Second, false, "ffmpeg_oom_killed")

	// Record playback events
	RecordPlaybackStart("web", 2160, "premium")
	RecordPlaybackStart("mobile", 1080, "standard")
	RecordPlaybackStart("mobile", 720, "free")

	IncActiveStreams()
	IncActiveStreams()
	DecActiveStreams()

	// Test Prometheus format
	reqProm := httptest.NewRequest("GET", "/metrics", nil)
	wProm := httptest.NewRecorder()
	Handler(wProm, reqProm)

	if wProm.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", wProm.Code)
	}

	bodyProm := wProm.Body.String()
	if !strings.Contains(bodyProm, "ott_transcode_success_total") {
		t.Errorf("expected prometheus body to contain ott_transcode_success_total, got: %s", bodyProm)
	}
	if !strings.Contains(bodyProm, "ott_playback_starts_total") {
		t.Errorf("expected prometheus body to contain ott_playback_starts_total, got: %s", bodyProm)
	}
	if !strings.Contains(bodyProm, "ott_active_streams 1") {
		t.Errorf("expected active streams gauge to be 1, got: %s", bodyProm)
	}

	// Test JSON format
	reqJSON := httptest.NewRequest("GET", "/metrics?format=json", nil)
	wJSON := httptest.NewRecorder()
	Handler(wJSON, reqJSON)

	if wJSON.Code != http.StatusOK {
		t.Fatalf("expected status 200 for JSON, got %d", wJSON.Code)
	}

	var jsonMap map[string]interface{}
	if err := json.Unmarshal(wJSON.Body.Bytes(), &jsonMap); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	transcodeMap, ok := jsonMap["transcode"].(map[string]interface{})
	if !ok || transcodeMap["success_total"] == nil {
		t.Fatalf("missing transcode.success_total in json: %v", jsonMap)
	}

	playbackMap, ok := jsonMap["playback"].(map[string]interface{})
	if !ok || playbackMap["starts_total"] == nil {
		t.Fatalf("missing playback.starts_total in json: %v", jsonMap)
	}
}
