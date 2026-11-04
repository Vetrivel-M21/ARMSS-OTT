package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func setupAccountDeleteTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(ON)")
	if err != nil {
		t.Fatalf("failed opening in-memory sqlite test db: %v", err)
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

	CREATE TABLE IF NOT EXISTS profiles (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		name VARCHAR(50) NOT NULL,
		avatar_color VARCHAR(30) NOT NULL,
		is_kids BOOLEAN NOT NULL DEFAULT FALSE,
		pin VARCHAR(10) DEFAULT '',
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS watchlist (
		user_id VARCHAR(64) NOT NULL,
		profile_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		added_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, profile_id, title_id)
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

	CREATE TABLE IF NOT EXISTS ratings (
		user_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		score INT NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, title_id)
	);

	CREATE TABLE IF NOT EXISTS user_devices (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		device_name VARCHAR(100) NOT NULL,
		client_type VARCHAR(32) NOT NULL,
		last_used_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS playback_sessions (
		session_id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		video_id VARCHAR(64) NOT NULL,
		last_heartbeat_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_otps (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		email VARCHAR(191) NOT NULL,
		otp_code VARCHAR(10) NOT NULL,
		purpose VARCHAR(50) NOT NULL,
		expires_at DATETIME NOT NULL,
		verified BOOLEAN NOT NULL DEFAULT FALSE,
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_activity_logs (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		action VARCHAR(50) NOT NULL,
		details VARCHAR(255) DEFAULT '',
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS payments (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		plan_id VARCHAR(32) NOT NULL,
		amount_inr INT NOT NULL,
		currency VARCHAR(10) NOT NULL DEFAULT 'INR',
		gateway VARCHAR(32) NOT NULL DEFAULT 'mock',
		order_id VARCHAR(128) NOT NULL,
		payment_id VARCHAR(128) NOT NULL,
		signature VARCHAR(255) DEFAULT '',
		status VARCHAR(32) NOT NULL DEFAULT 'pending',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	`

	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed creating schema: %v", err)
	}

	return db
}

func TestDeleteAccount_Authenticated(t *testing.T) {
	db := setupAccountDeleteTestDB(t)
	defer db.Close()

	oldDB := database.DB
	database.DB = db
	defer func() { database.DB = oldDB }()

	userID := "user-del-123"
	now := time.Now()

	// Seed user and associated data
	_, err := db.Exec("INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) VALUES (?, ?, 'hash', 'Test User', 'standard', 0, ?, ?)", userID, "testdelete@example.com", now, now)
	if err != nil {
		t.Fatalf("insert user error: %v", err)
	}
	_, _ = db.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, created_at) VALUES ('p1', ?, 'Main', 'blue', ?)", userID, now)
	_, _ = db.Exec("INSERT INTO watchlist (user_id, profile_id, title_id, added_at) VALUES (?, 'p1', 'title-1', ?)", userID, now)
	_, _ = db.Exec("INSERT INTO watch_progress (user_id, profile_id, title_id, progress_percent, time_seconds, updated_at) VALUES (?, 'p1', 'title-1', 45, 120, ?)", userID, now)

	// Call DeleteAccount with context
	req := httptest.NewRequest("DELETE", "/api/auth/delete-account", nil)
	ctx := context.WithValue(req.Context(), middleware.UserContextKey, &middleware.Claims{
		UserID: userID,
		Email:  "testdelete@example.com",
	})
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	DeleteAccount(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify user is gone
	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", userID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected user to be deleted, count = %d", count)
	}

	// Verify profiles and watchlist are gone
	_ = db.QueryRow("SELECT COUNT(*) FROM profiles WHERE user_id = ?", userID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected profiles to be deleted, count = %d", count)
	}
	_ = db.QueryRow("SELECT COUNT(*) FROM watchlist WHERE user_id = ?", userID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected watchlist to be deleted, count = %d", count)
	}
}

func TestDeleteAccountRequest_PublicWeb(t *testing.T) {
	db := setupAccountDeleteTestDB(t)
	defer db.Close()

	oldDB := database.DB
	database.DB = db
	defer func() { database.DB = oldDB }()

	userID := "user-web-456"
	email := "webdelete@example.com"
	password := "SecretPass123!"
	hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	now := time.Now()

	_, err := db.Exec("INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) VALUES (?, ?, ?, 'Web User', 'free', 0, ?, ?)", userID, email, string(hashed), now, now)
	if err != nil {
		t.Fatalf("insert user error: %v", err)
	}

	// 1. Test incorrect password
	badBody, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": "WrongPassword",
	})
	reqBad := httptest.NewRequest("POST", "/api/auth/delete-account-request", bytes.NewReader(badBody))
	rrBad := httptest.NewRecorder()
	DeleteAccountRequest(rrBad, reqBad)

	if rrBad.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for wrong password, got %d", rrBad.Code)
	}

	// 2. Test valid credentials
	goodBody, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	reqGood := httptest.NewRequest("POST", "/api/auth/delete-account-request", bytes.NewReader(goodBody))
	rrGood := httptest.NewRecorder()
	DeleteAccountRequest(rrGood, reqGood)

	if rrGood.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid credentials, got %d: %s", rrGood.Code, rrGood.Body.String())
	}

	// Verify user is deleted
	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", userID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected user to be deleted from database, count = %d", count)
	}
}

