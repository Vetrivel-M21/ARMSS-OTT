package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"armss-ott-backend/services/storage"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"
)

// TestEndToEndPipeline tests:
// 1. POST /admin/videos (video record creation + presigned upload target)
// 2. Direct upload of master file bytes to storage
// 3. POST /admin/videos/{id}/complete (enqueue transcode / transition to ready)
// 4. GET /videos/{id}/playback (entitlement verification + signed manifest generation)
// 5. GET /videos/{id}/master.m3u8 (fetch rewritten master playlist with short-lived presigned URLs)
// 6. GET /videos/{id}/{rendition}.m3u8 (fetch rendition playlists)
// 7. GET /videos/{id}/... (fetch first segment of each rendition)
func TestEndToEndPipeline(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()
	database.DB = db
	database.DriverName = "sqlite"

	// Mock S3 HTTP server storing objects in memory
	var mu sync.RWMutex
	s3Objects := make(map[string][]byte)

	s3Server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/")
		switch r.Method {
		case http.MethodPut:
			data, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			mu.Lock()
			s3Objects[key] = data
			mu.Unlock()
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			mu.RLock()
			data, ok := s3Objects[key]
			mu.RUnlock()
			if !ok {
				http.Error(w, "NoSuchKey", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/octet-stream")
			_, _ = w.Write(data)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer s3Server.Close()

	// Initialize S3 storage service pointing to mock server
	cfg := storage.Config{
		Endpoint:      s3Server.URL,
		AccessKey:     "minioadmin",
		SecretKey:     "minioadmin",
		Region:        "us-east-1",
		MastersBucket: "masters",
		HLSBucket:     "hls",
		UsePathStyle:  true,
		PublicBaseURL: s3Server.URL,
	}
	svc, err := storage.NewService(cfg)
	if err != nil {
		t.Fatalf("failed initializing test storage: %v", err)
	}
	storage.SetGlobalStorage(svc)

	// Create test admin user and JWT token
	adminID := "admin-user-e2e"
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) 
		VALUES (?, 'admin@armss.com', 'hash', 'Admin', 'premium', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, adminID)
	if err != nil {
		t.Fatalf("failed inserting admin: %v", err)
	}

	adminUser := &models.User{
		ID:               adminID,
		Email:            "admin@armss.com",
		Name:             "Admin",
		SubscriptionTier: models.TierPremium,
		IsAdmin:          true,
	}
	adminToken, err := middleware.GenerateToken(adminUser)
	if err != nil {
		t.Fatalf("failed generating admin token: %v", err)
	}

	// Router setup
	r := chi.NewRouter()
	r.Post("/admin/videos", AdminCreateVideo)
	r.Post("/admin/videos/{id}/complete", AdminCompleteVideoUpload)
	r.Get("/admin/videos/{id}", AdminGetVideo)
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)
	r.Get("/videos/{id}/master.m3u8", GetMasterPlaylist)
	r.Get("/videos/{id}/{rendition}.m3u8", GetRenditionPlaylist)
	r.Get("/api/videos/{id}/master.m3u8", GetMasterPlaylist)
	r.Get("/api/videos/{id}/{rendition}.m3u8", GetRenditionPlaylist)

	ts := httptest.NewServer(r)
	defer ts.Close()

	client := &http.Client{Timeout: 10 * time.Second}

	// -------------------------------------------------------------------------
	// Step 1: POST /admin/videos - Create video record & get upload target
	// -------------------------------------------------------------------------
	createBody, _ := json.Marshal(map[string]string{
		"title": "E2E Master 4K Cinema Video",
	})
	req, _ := http.NewRequest("POST", ts.URL+"/admin/videos", bytes.NewReader(createBody))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("step 1 failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("step 1 expected 201, got %d", resp.StatusCode)
	}

	var createResp map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&createResp)
	resp.Body.Close()

	videoID, ok := createResp["id"].(string)
	if !ok || videoID == "" {
		t.Fatalf("step 1 missing video id in response: %v", createResp)
	}
	uploadURL, _ := createResp["upload_url"].(string)
	masterKey, _ := createResp["master_key"].(string)
	if uploadURL == "" || masterKey == "" {
		t.Fatalf("step 1 missing upload_url or master_key")
	}

	// -------------------------------------------------------------------------
	// Step 2: Upload master video bytes to S3/Storage
	// -------------------------------------------------------------------------
	mockMasterBytes := []byte("FAKE_MP4_MASTER_VIDEO_PAYLOAD_FOR_E2E_VERIFICATION_HEADER_FTYP")
	uploadReq, _ := http.NewRequest("PUT", uploadURL, bytes.NewReader(mockMasterBytes))
	uploadReq.Header.Set("Content-Type", "video/mp4")
	uploadResp, err := client.Do(uploadReq)
	if err != nil {
		t.Fatalf("step 2 direct upload failed: %v", err)
	}
	if uploadResp.StatusCode < 200 || uploadResp.StatusCode >= 300 {
		t.Fatalf("step 2 upload expected 2xx, got %d", uploadResp.StatusCode)
	}
	uploadResp.Body.Close()

	// -------------------------------------------------------------------------
	// Step 3: Complete upload and transition to ready
	// -------------------------------------------------------------------------
	completeReq, _ := http.NewRequest("POST", ts.URL+fmt.Sprintf("/admin/videos/%s/complete", videoID), nil)
	completeReq.Header.Set("Authorization", "Bearer "+adminToken)
	compResp, err := client.Do(completeReq)
	if err != nil {
		t.Fatalf("step 3 complete request failed: %v", err)
	}
	if compResp.StatusCode != http.StatusOK {
		t.Fatalf("step 3 complete expected 200, got %d", compResp.StatusCode)
	}
	compResp.Body.Close()

	// Seed generated HLS master and renditions in mock S3 bucket
	rawMasterM3U8 := `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"
360p.m3u8
`
	mu.Lock()
	s3Objects[fmt.Sprintf("hls/videos/%s/master.m3u8", videoID)] = []byte(rawMasterM3U8)

	renditions := []string{"1080p", "720p", "480p", "360p"}
	for _, rung := range renditions {
		rungM3U8 := fmt.Sprintf(`#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="%s_init.mp4"
#EXTINF:4.000000,
%s_seg000.m4s
#EXTINF:4.000000,
%s_seg001.m4s
#EXT-X-ENDLIST
`, rung, rung, rung)
		s3Objects[fmt.Sprintf("hls/videos/%s/%s.m3u8", videoID, rung)] = []byte(rungM3U8)
		s3Objects[fmt.Sprintf("hls/videos/%s/%s_init.mp4", videoID, rung)] = []byte("INIT_MP4_BYTES_" + rung)
		s3Objects[fmt.Sprintf("hls/videos/%s/%s_seg000.m4s", videoID, rung)] = []byte("SEG000_M4S_BYTES_" + rung)
	}
	mu.Unlock()

	// Update DB record status to ready
	_, _ = db.Exec("UPDATE videos SET status = 'ready', duration = 120.5 WHERE id = ?", videoID)

	// -------------------------------------------------------------------------
	// Step 4: Call Playback API (GET /videos/:id/playback)
	// -------------------------------------------------------------------------
	playReq, _ := http.NewRequest("GET", ts.URL+fmt.Sprintf("/videos/%s/playback", videoID), nil)
	playReq.Header.Set("Authorization", "Bearer "+adminToken)
	playReq.Header.Set("X-Client-Type", "web")
	playReq.Header.Set("X-Device-ID", "e2e-device-1")

	playResp, err := client.Do(playReq)
	if err != nil {
		t.Fatalf("step 4 playback api failed: %v", err)
	}
	if playResp.StatusCode != http.StatusOK {
		t.Fatalf("step 4 playback api expected 200, got %d", playResp.StatusCode)
	}

	var playTicket models.PlaybackTicketResponse
	_ = json.NewDecoder(playResp.Body).Decode(&playTicket)
	playResp.Body.Close()

	if playTicket.ManifestURL == "" {
		t.Fatalf("step 4 empty manifest URL")
	}
	if playTicket.MaxHeight != 2160 { // Web premium gets 2160
		t.Errorf("expected maxHeight 2160, got %d", playTicket.MaxHeight)
	}

	// -------------------------------------------------------------------------
	// Step 5: Fetch Master Playlist (GET /videos/:id/master.m3u8?token=...)
	// -------------------------------------------------------------------------
	masterReqURL := ts.URL + playTicket.ManifestURL
	masterReq, _ := http.NewRequest("GET", masterReqURL, nil)
	masterResp, err := client.Do(masterReq)
	if err != nil {
		t.Fatalf("step 5 master playlist fetch failed: %v", err)
	}
	if masterResp.StatusCode != http.StatusOK {
		t.Fatalf("step 5 expected 200, got %d", masterResp.StatusCode)
	}

	masterContentBytes, _ := io.ReadAll(masterResp.Body)
	masterResp.Body.Close()
	masterContent := string(masterContentBytes)

	if !strings.Contains(masterContent, "#EXTM3U") {
		t.Fatalf("step 5 response is not a valid HLS playlist: %s", masterContent)
	}

	// -------------------------------------------------------------------------
	// Step 6 & 7: Fetch child rendition playlists and verify first segments
	// -------------------------------------------------------------------------
	for _, rung := range renditions {
		if !strings.Contains(masterContent, rung) {
			t.Errorf("master playlist missing rendition %s", rung)
		}

		// Parse token from manifest URL
		tokenIdx := strings.Index(playTicket.ManifestURL, "token=")
		tokenQuery := ""
		if tokenIdx != -1 {
			tokenQuery = playTicket.ManifestURL[tokenIdx:]
		}

		renditionURL := fmt.Sprintf("%s/videos/%s/%s.m3u8?%s", ts.URL, videoID, rung, tokenQuery)
		rendReq, _ := http.NewRequest("GET", renditionURL, nil)
		rendResp, err := client.Do(rendReq)
		if err != nil {
			t.Fatalf("failed fetching %s rendition playlist: %v", rung, err)
		}
		if rendResp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for %s rendition playlist, got %d", rung, rendResp.StatusCode)
		}

		rendBytes, _ := io.ReadAll(rendResp.Body)
		rendResp.Body.Close()
		rendContent := string(rendBytes)

		if !strings.Contains(rendContent, "#EXT-X-TARGETDURATION") {
			t.Errorf("rendition %s playlist missing TARGETDURATION tag", rung)
		}

		// Step 7: Check that segment URIs in rewritten playlist are presigned and fetchable
		lines := strings.Split(rendContent, "\n")
		var firstSegmentURL string
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if (strings.Contains(line, ".mp4") || strings.Contains(line, ".m4s")) && !strings.HasPrefix(line, "#") {
				firstSegmentURL = line
				break
			}
			if strings.HasPrefix(line, "#EXT-X-MAP:URI=\"") {
				start := len("#EXT-X-MAP:URI=\"")
				end := strings.Index(line[start:], "\"")
				if end != -1 {
					firstSegmentURL = line[start : start+end]
					break
				}
			}
		}

		if firstSegmentURL == "" {
			t.Fatalf("rendition %s playlist does not contain any fetchable segment URLs", rung)
		}

		// Fetch the first segment bytes
		segReq, _ := http.NewRequest("GET", firstSegmentURL, nil)
		segResp, err := client.Do(segReq)
		if err != nil {
			t.Fatalf("failed fetching first segment for rendition %s: %v", rung, err)
		}
		if segResp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 fetching segment for %s, got %d", rung, segResp.StatusCode)
		}
		segBytes, _ := io.ReadAll(segResp.Body)
		segResp.Body.Close()

		if len(segBytes) == 0 {
			t.Errorf("rendition %s returned empty segment payload", rung)
		}
	}

	t.Logf("✓ Complete E2E verification successful for Video ID: %s", videoID)
}
