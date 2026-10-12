package playback

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateAndValidatePlaybackToken(t *testing.T) {
	tokenStr, err := GeneratePlaybackToken("user-1", "vid-1", "dev-1", "web", 2160, 5*time.Minute)
	if err != nil {
		t.Fatalf("failed generating token: %v", err)
	}

	claims, err := ValidatePlaybackToken(tokenStr)
	if err != nil {
		t.Fatalf("failed validating valid token: %v", err)
	}

	if claims.UserID != "user-1" || claims.VideoID != "vid-1" || claims.MaxHeight != 2160 {
		t.Errorf("claims mismatch: %+v", claims)
	}
}

func TestValidatePlaybackToken_Expired(t *testing.T) {
	// Generate expired token (-1 minute)
	tokenStr, err := GeneratePlaybackToken("user-1", "vid-1", "dev-1", "web", 1080, -1*time.Minute)
	if err != nil {
		t.Fatalf("failed generating token: %v", err)
	}

	_, err = ValidatePlaybackToken(tokenStr)
	if err == nil {
		t.Fatalf("expected error for expired token, got nil")
	}
}

func TestRewriteMasterPlaylist_FiltersRungsExceedingMaxHeight(t *testing.T) {
	sampleMaster := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-STREAM-INF:BANDWIDTH=16000000,RESOLUTION=3840x2160,CODECS="avc1.640033,mp4a.40.2"
stream_0.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640029,mp4a.40.2"
stream_1.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
stream_2.m3u8
`
	token := "sample-token-abc"

	// 1. Mobile capping at 1080p: must omit 3840x2160 (stream_0.m3u8)
	rewritten1080 := RewriteMasterPlaylist([]byte(sampleMaster), "vid-123", token, 1080, "http://localhost:8081/api")
	if strings.Contains(rewritten1080, "3840x2160") {
		t.Errorf("expected 2160p (3840x2160) to be filtered out for 1080p max height, got:\n%s", rewritten1080)
	}
	if strings.Contains(rewritten1080, "stream_0.m3u8") {
		t.Errorf("expected stream_0.m3u8 to be removed, got:\n%s", rewritten1080)
	}
	if !strings.Contains(rewritten1080, "1920x1080") {
		t.Errorf("expected 1080p to be preserved, got:\n%s", rewritten1080)
	}
	if !strings.Contains(rewritten1080, "/api/videos/vid-123/stream_1.m3u8?token=sample-token-abc") {
		t.Errorf("expected stream_1.m3u8 to be rewritten with token URL, got:\n%s", rewritten1080)
	}

	// 2. Web with 2160p: must keep all rungs
	rewritten2160 := RewriteMasterPlaylist([]byte(sampleMaster), "vid-123", token, 2160, "http://localhost:8081/api")
	if !strings.Contains(rewritten2160, "3840x2160") {
		t.Errorf("expected 3840x2160 to be retained for 2160p max height")
	}
	if !strings.Contains(rewritten2160, "stream_0.m3u8") {
		t.Errorf("expected stream_0.m3u8 to be retained for 2160p max height")
	}
}
