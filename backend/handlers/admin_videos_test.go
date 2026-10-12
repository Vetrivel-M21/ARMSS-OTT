package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/models"
	"armss-ott-backend/services/storage"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(ON)")
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS videos (
		id VARCHAR(64) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
		master_key VARCHAR(512) NOT NULL,
		duration DOUBLE NOT NULL DEFAULT 0,
		error_message TEXT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create test schema: %v", err)
	}

	database.DB = db
	database.DriverName = "sqlite"
	return db
}

func setupTestStorage() *storage.Service {
	// Configure test storage pointing to mock endpoint
	cfg := storage.Config{
		Endpoint:      "http://127.0.0.1:9000",
		AccessKey:     "testkey",
		SecretKey:     "testsecret",
		Region:        "us-east-1",
		MastersBucket: "masters",
		HLSBucket:     "hls",
		UsePathStyle:  true,
		PublicBaseURL: "http://localhost:9000",
	}
	svc, _ := storage.NewService(cfg)
	storage.SetGlobalStorage(svc)
	return svc
}

func TestAdminCreateVideo_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	setupTestStorage()

	reqBody := `{"title":"Cosmos 4K Ultra HD"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/videos", bytes.NewBufferString(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	AdminCreateVideo(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.CreateVideoResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v", err)
	}

	if resp.ID == "" {
		t.Errorf("expected non-empty video ID")
	}
	if resp.Title != "Cosmos 4K Ultra HD" {
		t.Errorf("expected title 'Cosmos 4K Ultra HD', got '%s'", resp.Title)
	}
	if resp.Status != models.VideoStatusUploaded {
		t.Errorf("expected status 'uploaded', got '%s'", resp.Status)
	}
	if resp.UploadURL == "" {
		t.Errorf("expected presigned upload URL to be non-empty")
	}

	// Verify row in database
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM videos WHERE id = ?", resp.ID).Scan(&count)
	if err != nil || count != 1 {
		t.Errorf("expected video record in database, found %d (err: %v)", count, err)
	}
}

func TestAdminCreateVideo_EmptyTitle(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	setupTestStorage()

	reqBody := `{"title":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/admin/videos", bytes.NewBufferString(reqBody))
	rec := httptest.NewRecorder()

	AdminCreateVideo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request for empty title, got %d", rec.Code)
	}
}

func TestAdminGetVideo_FoundAndNotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	setupTestStorage()

	now := time.Now()
	testID := "test-uuid-999"
	_, err := db.Exec(
		"INSERT INTO videos (id, title, status, master_key, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		testID, "Interstellar 4K", models.VideoStatusReady, "videos/test-uuid-999/master.mp4", 169.5, now, now,
	)
	if err != nil {
		t.Fatalf("failed inserting test row: %v", err)
	}

	r := chi.NewRouter()
	r.Get("/admin/videos/{id}", AdminGetVideo)

	// Test Found
	req := httptest.NewRequest(http.MethodGet, "/admin/videos/"+testID, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var data map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &data)
	if data["id"] != testID {
		t.Errorf("expected id %s, got %v", testID, data["id"])
	}
	if data["status"] != models.VideoStatusReady {
		t.Errorf("expected status 'ready', got %v", data["status"])
	}
	if data["playback_url"] == nil || data["playback_url"] == "" {
		t.Errorf("expected playback_url for ready video, got nil")
	}

	// Test Not Found
	req404 := httptest.NewRequest(http.MethodGet, "/admin/videos/non-existent-id", nil)
	rec404 := httptest.NewRecorder()
	r.ServeHTTP(rec404, req404)

	if rec404.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found, got %d", rec404.Code)
	}
}

func TestAdminListVideos(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	setupTestStorage()

	now := time.Now()
	_, _ = db.Exec("INSERT INTO videos (id, title, status, master_key, duration, created_at, updated_at) VALUES ('v1', 'Title 1', 'uploaded', 'k1', 0, ?, ?)", now, now)
	_, _ = db.Exec("INSERT INTO videos (id, title, status, master_key, duration, created_at, updated_at) VALUES ('v2', 'Title 2', 'ready', 'k2', 120, ?, ?)", now, now)

	req := httptest.NewRequest(http.MethodGet, "/admin/videos", nil)
	rec := httptest.NewRecorder()

	AdminListVideos(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		Videos []models.Video `json:"videos"`
		Total  int            `json:"total"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed decoding list: %v", err)
	}

	if result.Total != 2 {
		t.Errorf("expected total 2, got %d", result.Total)
	}
}
