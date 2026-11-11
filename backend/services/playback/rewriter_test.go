package playback

import (
	"context"
	"fmt"
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

func TestResolveRenditionFilename(t *testing.T) {
	sampleMaster := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-STREAM-INF:BANDWIDTH=16000000,RESOLUTION=3840x2160
stream_0.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
stream_1.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
stream_2.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360
stream_3.m3u8
`
	masterBytes := []byte(sampleMaster)

	// 1. Direct stream name
	if res := ResolveRenditionFilename(masterBytes, "v1", "stream_0.m3u8"); res != "stream_0.m3u8" {
		t.Errorf("expected stream_0.m3u8, got %s", res)
	}

	// 2. 1080p mapping
	if res := ResolveRenditionFilename(masterBytes, "v1", "1080p"); res != "stream_1.m3u8" {
		t.Errorf("expected stream_1.m3u8 for 1080p, got %s", res)
	}

	// 3. 720p mapping with .m3u8
	if res := ResolveRenditionFilename(masterBytes, "v1", "720p.m3u8"); res != "stream_2.m3u8" {
		t.Errorf("expected stream_2.m3u8 for 720p.m3u8, got %s", res)
	}

	// 4. /index.m3u8 suffix from legacy mobile
	if res := ResolveRenditionFilename(masterBytes, "v1", "1080p/index.m3u8"); res != "stream_1.m3u8" {
		t.Errorf("expected stream_1.m3u8 for 1080p/index.m3u8, got %s", res)
	}
}

func TestRewriteMasterPlaylist_RewritesMediaAudioAndSubtitles(t *testing.T) {
	sampleMaster := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="en",URI="audio_en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Tamil",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="ta",URI="audio_ta.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="en",URI="subs_en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,AUDIO="audio",SUBTITLES="subs"
stream_0.m3u8
`
	token := "tok-xyz"
	rewritten := RewriteMasterPlaylist([]byte(sampleMaster), "vid-999", token, 1080, "http://localhost:8081/api")

	if !strings.Contains(rewritten, `URI="http://localhost:8081/api/videos/vid-999/audio_en.m3u8?token=tok-xyz"`) {
		t.Errorf("expected rewritten English audio URI with token, got:\n%s", rewritten)
	}
	if !strings.Contains(rewritten, `URI="http://localhost:8081/api/videos/vid-999/audio_ta.m3u8?token=tok-xyz"`) {
		t.Errorf("expected rewritten Tamil audio URI with token, got:\n%s", rewritten)
	}
	if !strings.Contains(rewritten, `URI="http://localhost:8081/api/videos/vid-999/subs_en.m3u8?token=tok-xyz"`) {
		t.Errorf("expected rewritten Subtitles URI with token, got:\n%s", rewritten)
	}
}

func TestRewriteRenditionPlaylist_RewritesSegmentsToProxyURI(t *testing.T) {
	sampleRendition := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="init_0.mp4"
#EXTINF:4.000000,
stream_0_00000.m4s
#EXTINF:4.000000,
stream_0_00001.m4s
#EXTINF:3.500000,
stream_0_00002.m4s
#EXT-X-ENDLIST
`
	token := "playback-jwt-token-xyz"
	ctx := context.Background()

	rewritten, err := RewriteRenditionPlaylist(ctx, []byte(sampleRendition), "vid-movie-1", nil, token, false, "http://localhost:8081/api")
	if err != nil {
		t.Fatalf("unexpected error rewriting rendition: %v", err)
	}

	// 1. Verify init map rewritten to full proxy URL
	expectedMap := `URI="http://localhost:8081/api/videos/vid-movie-1/segment/init_0.mp4?token=playback-jwt-token-xyz"`
	if !strings.Contains(rewritten, expectedMap) {
		t.Errorf("expected init map rewritten to %s, got:\n%s", expectedMap, rewritten)
	}

	// 2. Verify segments rewritten to full proxy path + token
	if !strings.Contains(rewritten, "http://localhost:8081/api/videos/vid-movie-1/segment/stream_0_00000.m4s?token=playback-jwt-token-xyz") {
		t.Errorf("expected segment 0 to be rewritten with proxy path, got:\n%s", rewritten)
	}
	if !strings.Contains(rewritten, "http://localhost:8081/api/videos/vid-movie-1/segment/stream_0_00001.m4s?token=playback-jwt-token-xyz") {
		t.Errorf("expected segment 1 to be rewritten with proxy path, got:\n%s", rewritten)
	}

	// 3. Verify no raw S3 / presigned URLs present
	if strings.Contains(rewritten, "X-Amz-") || strings.Contains(rewritten, "s3.") {
		t.Errorf("expected no full presigned S3 URLs in media playlist, got:\n%s", rewritten)
	}

	// 4. Verify VOD tags are present
	if !strings.Contains(rewritten, "#EXT-X-PLAYLIST-TYPE:VOD") {
		t.Errorf("expected #EXT-X-PLAYLIST-TYPE:VOD to be present")
	}
	if !strings.Contains(rewritten, "#EXT-X-ENDLIST") {
		t.Errorf("expected #EXT-X-ENDLIST to be present")
	}
}

func TestRewriteRenditionPlaylist_RelativeFallbackWhenNoBaseURL(t *testing.T) {
	sampleRendition := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MAP:URI="init_0.mp4"
#EXTINF:4.000000,
stream_0_00000.m4s
#EXT-X-ENDLIST
`
	token := "playback-jwt-token-xyz"
	ctx := context.Background()

	rewritten, err := RewriteRenditionPlaylist(ctx, []byte(sampleRendition), "vid-movie-1", nil, token, false, "")
	if err != nil {
		t.Fatalf("unexpected error rewriting rendition: %v", err)
	}

	expectedMap := `URI="segment/init_0.mp4?token=playback-jwt-token-xyz"`
	if !strings.Contains(rewritten, expectedMap) {
		t.Errorf("expected relative init map %s, got:\n%s", expectedMap, rewritten)
	}

	expectedSeg := "segment/stream_0_00000.m4s?token=playback-jwt-token-xyz"
	if !strings.Contains(rewritten, expectedSeg) {
		t.Errorf("expected relative segment %s, got:\n%s", expectedSeg, rewritten)
	}
}

func TestRewriteRenditionPlaylist_LongVideoSizeOptimization(t *testing.T) {
	// Simulate 2-hour movie: 1,800 segments (4s each)
	var sb strings.Builder
	sb.WriteString("#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:4\n#EXT-X-MAP:URI=\"init_0.mp4\"\n")
	for i := 0; i < 1800; i++ {
		sb.WriteString(fmt.Sprintf("#EXTINF:4.000000,\nstream_0_%05d.m4s\n", i))
	}
	sb.WriteString("#EXT-X-ENDLIST\n")

	token := "jwt.sample.longtokenvalue1234567890abcdefghijklmnopqrstuvwxyz"
	ctx := context.Background()

	rewritten, err := RewriteRenditionPlaylist(ctx, []byte(sb.String()), "long-movie-999", nil, token, false, "http://localhost:8081/api")
	if err != nil {
		t.Fatalf("unexpected error rewriting long video rendition: %v", err)
	}

	rewrittenSize := len(rewritten)
	// For 1,800 segments with old long presigned URLs (~450 bytes each), the playlist was > 800 KB!
	// With the new proxy URLs, it must easily stay well under 300 KB.
	if rewrittenSize > 300*1024 {
		t.Errorf("expected playlist size for 2h movie to be < 300 KB, got %d bytes (%.2f KB)", rewrittenSize, float64(rewrittenSize)/1024)
	}

	t.Logf("2-hour movie playlist size with segment proxy: %d bytes (%.2f KB)", rewrittenSize, float64(rewrittenSize)/1024)
}

