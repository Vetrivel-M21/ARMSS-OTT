package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"armss-ott-backend/services/playback"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"
)

func setupPlaybackTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(ON)")
	if err != nil {
		t.Fatalf("failed to open test sqlite: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(64) PRIMARY KEY,
		email VARCHAR(191) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		name VARCHAR(100) NOT NULL,
		subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
		is_admin BOOLEAN NOT NULL DEFAULT FALSE,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS titles (
		id VARCHAR(100) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		required_tier VARCHAR(50) NOT NULL DEFAULT 'free'
	);

	CREATE TABLE IF NOT EXISTS videos (
		id VARCHAR(64) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'ready',
		master_key VARCHAR(512) NOT NULL,
		duration DOUBLE NOT NULL DEFAULT 0,
		error_message TEXT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS watch_progress (
		user_id VARCHAR(64) NOT NULL,
		profile_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		episode_id VARCHAR(100) DEFAULT '',
		progress_percent DOUBLE NOT NULL,
		time_seconds DOUBLE NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, profile_id, title_id)
	);

	CREATE TABLE IF NOT EXISTS user_devices (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		device_name VARCHAR(100) NOT NULL DEFAULT 'Unknown Device',
		client_type VARCHAR(32) NOT NULL DEFAULT 'web',
		last_used_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		UNIQUE(user_id, device_id)
	);

	CREATE TABLE IF NOT EXISTS playback_sessions (
		session_id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		video_id VARCHAR(64) NOT NULL,
		last_heartbeat_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL
	);
	`

	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed creating schema: %v", err)
	}

	database.DB = db
	database.DriverName = "sqlite"
	return db
}

func TestGetPlaybackTicket_UnauthenticatedReturns401(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)

	req := httptest.NewRequest(http.MethodGet, "/videos/movie-123/playback", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", rec.Code)
	}
}

func TestGetPlaybackTicket_UnsubscribedReturns403(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	// Insert premium title
	_, _ = db.Exec("INSERT INTO titles (id, title, required_tier) VALUES ('premium-movie', 'Premium Movie 4K', 'premium')")

	// Free tier user
	freeUser := &models.User{
		ID:               "user-free-1",
		Email:            "free@example.com",
		SubscriptionTier: models.TierFree,
	}
	token, _ := middleware.GenerateToken(freeUser)

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)

	req := httptest.NewRequest(http.MethodGet, "/videos/premium-movie/playback", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unsubscribed user, got %d: %s", rec.Code, rec.Body.String())
	}

	var errResp map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
	if errResp["error"] != "tier_upgrade_required" {
		t.Errorf("expected error 'tier_upgrade_required', got %v", errResp["error"])
	}
}

func TestGetPlaybackTicket_SubscribedReturnsManifestAndMaxHeight(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	// Insert premium title
	_, _ = db.Exec("INSERT INTO titles (id, title, required_tier) VALUES ('premium-movie', 'Premium Movie 4K', 'premium')")
	now := time.Now()
	_, _ = db.Exec("INSERT INTO watch_progress (user_id, profile_id, title_id, time_seconds, progress_percent, updated_at) VALUES ('user-prem-1', 'default', 'premium-movie', 75.5, 20.0, ?)", now)

	// Premium tier user
	premiumUser := &models.User{
		ID:               "user-prem-1",
		Email:            "prem@example.com",
		SubscriptionTier: models.TierPremium,
	}
	token, _ := middleware.GenerateToken(premiumUser)

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)

	// Test 1: Web client gets 2160 (4K)
	reqWeb := httptest.NewRequest(http.MethodGet, "/videos/premium-movie/playback", nil)
	reqWeb.Header.Set("Authorization", "Bearer "+token)
	reqWeb.Header.Set("X-Client-Type", "web")
	reqWeb.Header.Set("X-Device-ID", "dev-web-01")
	recWeb := httptest.NewRecorder()
	r.ServeHTTP(recWeb, reqWeb)

	if recWeb.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for subscribed user on web, got %d: %s", recWeb.Code, recWeb.Body.String())
	}

	var resp models.PlaybackTicketResponse
	_ = json.Unmarshal(recWeb.Body.Bytes(), &resp)
	if resp.MaxHeight != 2160 {
		t.Errorf("expected maxHeight 2160 for web premium, got %d", resp.MaxHeight)
	}
	if resp.ResumePositionSec != 75.5 {
		t.Errorf("expected resume position 75.5, got %f", resp.ResumePositionSec)
	}

	// Test 2: Mobile client capped at 1080
	reqMob := httptest.NewRequest(http.MethodGet, "/videos/premium-movie/playback", nil)
	reqMob.Header.Set("Authorization", "Bearer "+token)
	reqMob.Header.Set("X-Client-Type", "mobile")
	reqMob.Header.Set("X-Device-ID", "dev-mob-01")
	recMob := httptest.NewRecorder()
	r.ServeHTTP(recMob, reqMob)

	if recMob.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for mobile client, got %d", recMob.Code)
	}
	var respMob models.PlaybackTicketResponse
	_ = json.Unmarshal(recMob.Body.Bytes(), &respMob)
	if respMob.MaxHeight != 1080 {
		t.Errorf("expected mobile client to cap at 1080, got %d", respMob.MaxHeight)
	}
}

func TestGetPlaybackTicket_DeviceLimitEnforced(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	_, _ = db.Exec("INSERT INTO titles (id, title, required_tier) VALUES ('title-free', 'Free Movie', 'free')")

	user := &models.User{
		ID:               "user-device-test",
		Email:            "devtest@example.com",
		SubscriptionTier: models.TierFree,
	}
	token, _ := middleware.GenerateToken(user)

	// Pre-fill 5 registered devices
	now := time.Now()
	for i := 1; i <= 5; i++ {
		devID := fmt.Sprintf("dev-%d", i)
		_, _ = db.Exec("INSERT INTO user_devices (id, user_id, device_id, device_name, client_type, last_used_at, created_at) VALUES (?, ?, ?, 'Device', 'web', ?, ?)",
			fmt.Sprintf("ud-%d", i), user.ID, devID, now, now)
	}

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)

	// Attempting 6th device should return 403
	req6 := httptest.NewRequest(http.MethodGet, "/videos/title-free/playback", nil)
	req6.Header.Set("Authorization", "Bearer "+token)
	req6.Header.Set("X-Device-ID", "dev-6-new")
	rec6 := httptest.NewRecorder()

	r.ServeHTTP(rec6, req6)

	if rec6.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for exceeding device limit, got %d", rec6.Code)
	}

	var errResp map[string]interface{}
	_ = json.Unmarshal(rec6.Body.Bytes(), &errResp)
	if errResp["error"] != "device_limit_exceeded" {
		t.Errorf("expected error 'device_limit_exceeded', got %v", errResp["error"])
	}
}

func TestGetPlaybackTicket_ConcurrentStreamLimitEnforced(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	_, _ = db.Exec("INSERT INTO titles (id, title, required_tier) VALUES ('free-stream', 'Free Movie', 'free')")

	// Free tier user (Limit = 1 concurrent stream)
	user := &models.User{
		ID:               "user-concurrency-test",
		Email:            "concurrency@example.com",
		SubscriptionTier: models.TierFree,
	}
	token, _ := middleware.GenerateToken(user)

	// Pre-insert an active playback session for device-A within the last 10 seconds
	now := time.Now()
	_, _ = db.Exec("INSERT INTO playback_sessions (session_id, user_id, device_id, video_id, last_heartbeat_at, created_at) VALUES ('sess-active', ?, 'device-A', 'free-stream', ?, ?)",
		user.ID, now, now)

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", GetPlaybackTicket)

	// Device-B tries to start streaming while Device-A is actively streaming
	reqB := httptest.NewRequest(http.MethodGet, "/videos/free-stream/playback", nil)
	reqB.Header.Set("Authorization", "Bearer "+token)
	reqB.Header.Set("X-Device-ID", "device-B")
	recB := httptest.NewRecorder()

	r.ServeHTTP(recB, reqB)

	if recB.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for concurrent stream limit, got %d", recB.Code)
	}

	var errResp map[string]interface{}
	_ = json.Unmarshal(recB.Body.Bytes(), &errResp)
	if errResp["error"] != "concurrent_stream_limit_exceeded" {
		t.Errorf("expected 'concurrent_stream_limit_exceeded', got %v", errResp["error"])
	}
}

func TestGetMasterPlaylist_ExpiredTokenReturns401(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/videos/{id}/master.m3u8", GetMasterPlaylist)

	// Expired token
	expiredToken, _ := playback.GeneratePlaybackToken("u1", "vid-1", "dev1", "web", 1080, -2*time.Minute)

	req := httptest.NewRequest(http.MethodGet, "/videos/vid-1/master.m3u8?token="+expiredToken, nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for expired playlist token, got %d", rec.Code)
	}
}

func TestSaveWatchProgress_Success(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	user := &models.User{
		ID:               "u-progress",
		Email:            "progress@example.com",
		SubscriptionTier: models.TierFree,
	}
	token, _ := middleware.GenerateToken(user)

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Post("/videos/{id}/progress", SaveWatchProgress)

	body := `{"time_seconds": 180.5, "progress_percent": 55.0, "profile_id": "prof-1"}`
	req := httptest.NewRequest(http.MethodPost, "/videos/vid-999/progress", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var timeSec float64
	err := db.QueryRow("SELECT time_seconds FROM watch_progress WHERE user_id = 'u-progress' AND title_id = 'vid-999'").Scan(&timeSec)
	if err != nil || timeSec != 180.5 {
		t.Errorf("expected saved progress 180.5, got %f (err: %v)", timeSec, err)
	}
}

func TestSendStreamHeartbeat_Success(t *testing.T) {
	db := setupPlaybackTestDB(t)
	defer db.Close()

	user := &models.User{
		ID:               "u-heartbeat",
		Email:            "hb@example.com",
		SubscriptionTier: models.TierFree,
	}
	token, _ := middleware.GenerateToken(user)

	r := chi.NewRouter()
	r.With(middleware.RequireAuth).Post("/videos/{id}/heartbeat", SendStreamHeartbeat)

	body := `{"session_id": "sess-1234", "device_id": "dev-hb-1"}`
	req := httptest.NewRequest(http.MethodPost, "/videos/vid-hb/heartbeat", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM playback_sessions WHERE session_id = 'sess-1234' AND user_id = 'u-heartbeat'").Scan(&count)
	if err != nil || count != 1 {
		t.Errorf("expected active session in database, found %d (err: %v)", count, err)
	}
}
