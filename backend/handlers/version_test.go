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
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS site_settings (
			setting_key VARCHAR(64) PRIMARY KEY,
			setting_value TEXT NOT NULL,
			updated_at DATETIME NOT NULL
		);
	`)
	if err != nil {
		t.Fatalf("failed to create site_settings: %v", err)
	}

	database.DB = db
	database.DriverName = "sqlite"
}

func TestGetAppVersion_Default(t *testing.T) {
	setupTestDB(t)

	req := httptest.NewRequest("GET", "/api/app/version", nil)
	rr := httptest.NewRecorder()

	GetAppVersion(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp AppVersionResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if resp.LatestVersion != "1.0.0" {
		t.Errorf("expected latest_version 1.0.0, got %s", resp.LatestVersion)
	}
	if resp.PackageName != "com.armss.ott.armss_ott_mobile" {
		t.Errorf("expected package name com.armss.ott.armss_ott_mobile, got %s", resp.PackageName)
	}
	if resp.MarketURI != "market://details?id=com.armss.ott.armss_ott_mobile" {
		t.Errorf("expected market_uri, got %s", resp.MarketURI)
	}
	if resp.UpdateAvailable != false {
		t.Errorf("expected update_available false, got %v", resp.UpdateAvailable)
	}
}

func TestGetAppVersion_Evaluation(t *testing.T) {
	setupTestDB(t)

	cfg := AppVersionConfig{
		LatestVersion:     "1.2.0",
		LatestBuildNumber: 10,
		MinVersion:        "1.1.0",
		MinBuildNumber:    5,
		ForceUpdate:       false,
		Title:             "Update Available",
		ReleaseNotes:      "Bug fixes and speed improvements",
		PackageName:       "com.armss.ott.armss_ott_mobile",
		PlayStoreURL:      "https://play.google.com/store/apps/details?id=com.armss.ott.armss_ott_mobile",
		IsActive:          true,
		UpdatedAt:         time.Now(),
	}

	raw, _ := json.Marshal(cfg)
	_ = database.SetSetting("mobile_app_version", string(raw))

	// Case 1: Client has build 10 (Up to date)
	{
		req := httptest.NewRequest("GET", "/api/app/version?build=10", nil)
		rr := httptest.NewRecorder()
		GetAppVersion(rr, req)

		var resp AppVersionResponse
		_ = json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp.UpdateAvailable || resp.UpdateRequired {
			t.Errorf("build 10 should not need update")
		}
	}

	// Case 2: Client has build 7 (Flexible update available, but not required because >= min 5)
	{
		req := httptest.NewRequest("GET", "/api/app/version?build=7", nil)
		rr := httptest.NewRecorder()
		GetAppVersion(rr, req)

		var resp AppVersionResponse
		_ = json.Unmarshal(rr.Body.Bytes(), &resp)
		if !resp.UpdateAvailable {
			t.Errorf("build 7 should have update_available = true")
		}
		if resp.UpdateRequired {
			t.Errorf("build 7 should have update_required = false")
		}
	}

	// Case 3: Client has build 3 (Below min 5 -> Force update required)
	{
		req := httptest.NewRequest("GET", "/api/app/version?build=3", nil)
		rr := httptest.NewRecorder()
		GetAppVersion(rr, req)

		var resp AppVersionResponse
		_ = json.Unmarshal(rr.Body.Bytes(), &resp)
		if !resp.UpdateAvailable || !resp.UpdateRequired {
			t.Errorf("build 3 must have update_required = true")
		}
	}
}

func TestAdminUpdateAppVersion(t *testing.T) {
	setupTestDB(t)

	payload := `{
		"latest_version": "2.0.0",
		"latest_build_number": 20,
		"min_version": "1.5.0",
		"min_build_number": 15,
		"force_update": true,
		"title": "Major Update 2.0",
		"release_notes": "All new UI design",
		"package_name": "com.armss.ott.armss_ott_mobile",
		"play_store_url": "https://play.google.com/store/apps/details?id=com.armss.ott.armss_ott_mobile",
		"is_active": true
	}`

	req := httptest.NewRequest("PUT", "/api/admin/app/version", bytes.NewBufferString(payload))
	rr := httptest.NewRecorder()

	AdminUpdateAppVersion(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify loaded
	cfg := LoadAppVersionConfig()
	if cfg.LatestVersion != "2.0.0" || cfg.LatestBuildNumber != 20 {
		t.Errorf("expected version 2.0.0 / 20, got %s / %d", cfg.LatestVersion, cfg.LatestBuildNumber)
	}
	if !cfg.ForceUpdate {
		t.Errorf("expected force_update = true")
	}
}

