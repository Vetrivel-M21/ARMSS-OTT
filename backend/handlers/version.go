package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"armss-ott-backend/database"
)

// AppVersionConfig represents the mobile app version control & Play Store update configuration.
type AppVersionConfig struct {
	LatestVersion     string    `json:"latest_version"`
	LatestBuildNumber int       `json:"latest_build_number"`
	MinVersion        string    `json:"min_version"`
	MinBuildNumber    int       `json:"min_build_number"`
	ForceUpdate       bool      `json:"force_update"`
	Title             string    `json:"title"`
	ReleaseNotes      string    `json:"release_notes"`
	PackageName       string    `json:"package_name"`
	PlayStoreURL      string    `json:"play_store_url"`
	AndroidApkURL     string    `json:"android_apk_url"` // Optional direct APK link for testing/sideloading
	IOSURL            string    `json:"ios_url"`
	IsActive          bool      `json:"is_active"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// AppVersionResponse is returned to mobile clients querying the update status.
type AppVersionResponse struct {
	AppVersionConfig
	UpdateAvailable bool   `json:"update_available"`
	UpdateRequired  bool   `json:"update_required"`
	MarketURI       string `json:"market_uri"`
}

var defaultAppVersion = AppVersionConfig{
	LatestVersion:     "1.0.0",
	LatestBuildNumber: 1,
	MinVersion:        "1.0.0",
	MinBuildNumber:    1,
	ForceUpdate:       false,
	Title:             "AURA Mobile App Update",
	ReleaseNotes:      "• High-performance HLS streaming with CMAF fMP4\n• Google Play Store synchronized updates\n• Adaptive 4K and 1080p video player\n• Offline download and multi-profile support",
	PackageName:       "com.armss.ott.armss_ott_mobile",
	PlayStoreURL:      "https://play.google.com/store/apps/details?id=com.armss.ott.armss_ott_mobile",
	AndroidApkURL:     "",
	IOSURL:            "https://apps.apple.com/app/aura-ott",
	IsActive:          true,
	UpdatedAt:         time.Now(),
}

// LoadAppVersionConfig loads the active version configuration from database.
func LoadAppVersionConfig() AppVersionConfig {
	val, err := database.GetSetting("mobile_app_version")
	if err != nil || val == "" {
		return defaultAppVersion
	}

	var cfg AppVersionConfig
	if err := json.Unmarshal([]byte(val), &cfg); err != nil {
		return defaultAppVersion
	}
	return cfg
}

// GetAppVersion — GET /api/app/version (Public)
// Returns mobile app update configuration. If ?build=X is passed, computes update_available, update_required, and market_uri.
func GetAppVersion(w http.ResponseWriter, r *http.Request) {
	cfg := LoadAppVersionConfig()

	resp := AppVersionResponse{
		AppVersionConfig: cfg,
		UpdateAvailable:  false,
		UpdateRequired:   false,
		MarketURI:        "market://details?id=" + cfg.PackageName,
	}

	buildParam := r.URL.Query().Get("build")
	if buildParam != "" {
		if clientBuild, err := strconv.Atoi(buildParam); err == nil {
			if cfg.IsActive {
				if clientBuild < cfg.MinBuildNumber || (cfg.ForceUpdate && clientBuild < cfg.LatestBuildNumber) {
					resp.UpdateRequired = true
					resp.UpdateAvailable = true
				} else if clientBuild < cfg.LatestBuildNumber {
					resp.UpdateAvailable = true
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// AdminGetAppVersion — GET /api/admin/app/version (Admin Only)
func AdminGetAppVersion(w http.ResponseWriter, r *http.Request) {
	cfg := LoadAppVersionConfig()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"config":  cfg,
	})
}

// AdminUpdateAppVersion — PUT /api/admin/app/version (Admin Only)
func AdminUpdateAppVersion(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil || len(body) == 0 {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	var cfg AppVersionConfig
	if err := json.Unmarshal(body, &cfg); err != nil {
		http.Error(w, `{"error":"malformed JSON: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	// Validation & Defaults
	if cfg.PackageName == "" {
		cfg.PackageName = "com.armss.ott.armss_ott_mobile"
	}
	if cfg.PlayStoreURL == "" {
		cfg.PlayStoreURL = "https://play.google.com/store/apps/details?id=" + cfg.PackageName
	}
	if cfg.LatestVersion == "" {
		cfg.LatestVersion = "1.0.0"
	}
	if cfg.LatestBuildNumber <= 0 {
		cfg.LatestBuildNumber = 1
	}
	if cfg.MinVersion == "" {
		cfg.MinVersion = cfg.LatestVersion
	}
	if cfg.MinBuildNumber <= 0 {
		cfg.MinBuildNumber = 1
	}
	if cfg.MinBuildNumber > cfg.LatestBuildNumber {
		cfg.MinBuildNumber = cfg.LatestBuildNumber
	}
	cfg.UpdatedAt = time.Now()

	bytes, err := json.Marshal(cfg)
	if err != nil {
		http.Error(w, `{"error":"failed to serialize config"}`, http.StatusInternalServerError)
		return
	}

	if err := database.SetSetting("mobile_app_version", string(bytes)); err != nil {
		http.Error(w, `{"error":"failed to persist version config: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App version update configuration saved successfully",
		"config":  cfg,
	})
}
