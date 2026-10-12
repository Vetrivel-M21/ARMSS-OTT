package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"armss-ott-backend/services/metrics"
	"armss-ott-backend/services/playback"
	"armss-ott-backend/services/storage"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GetPlaybackTicket handles GET /api/videos/{id}/playback (and /videos/{id}/playback).
// Verifies authentication, active subscription tier entitlement, device registration,
// and concurrent stream limits, then returns {manifestUrl, maxHeight, resumePositionSec}.
func GetPlaybackTicket(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	if videoID == "" {
		http.Error(w, `{"error":"video id is required"}`, http.StatusBadRequest)
		return
	}

	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// 1. Device identification
	deviceID := r.Header.Get("X-Device-ID")
	if deviceID == "" {
		deviceID = r.URL.Query().Get("device_id")
		if deviceID == "" {
			// Auto fallback fingerprint
			deviceID = "dev-" + claims.UserID[:8]
		}
	}

	clientType := strings.ToLower(r.Header.Get("X-Client-Type"))
	if clientType == "" {
		ua := strings.ToLower(r.Header.Get("User-Agent"))
		if strings.Contains(ua, "mobile") || strings.Contains(ua, "android") || strings.Contains(ua, "iphone") {
			clientType = "mobile"
		} else {
			clientType = "web"
		}
	}

	// 2. Title & Subscription Entitlement Check
	userTier := claims.SubscriptionTier
	if userTier == "" {
		userTier = models.TierFree
	}

	// Determine required tier from videos or titles table
	requiredTier := models.TierFree
	var titleFound bool

	// Check titles table first
	var titleReqTier sql.NullString
	var titleVideoURL, titleTrailer sql.NullString
	err := database.DB.QueryRowContext(r.Context(), "SELECT required_tier, video_url, trailer FROM titles WHERE id = ?", videoID).Scan(&titleReqTier, &titleVideoURL, &titleTrailer)
	if err == nil {
		if titleReqTier.Valid && titleReqTier.String != "" {
			requiredTier = models.SubscriptionTier(titleReqTier.String)
		}
		titleFound = true
	} else {
		// Check episodes table
		var epTitleID string
		var epVideoURL sql.NullString
		epErr := database.DB.QueryRowContext(r.Context(), "SELECT title_id, video_url FROM episodes WHERE id = ?", videoID).Scan(&epTitleID, &epVideoURL)
		if epErr == nil {
			titleFound = true
			if epVideoURL.Valid && strings.TrimSpace(epVideoURL.String) != "" {
				titleVideoURL = epVideoURL
			}
			_ = database.DB.QueryRowContext(r.Context(), "SELECT required_tier FROM titles WHERE id = ?", epTitleID).Scan(&titleReqTier)
			if titleReqTier.Valid && titleReqTier.String != "" {
				requiredTier = models.SubscriptionTier(titleReqTier.String)
			}
		} else {
			// Check videos table
			var vID, vStatus string
			vErr := database.DB.QueryRowContext(r.Context(), "SELECT id, status FROM videos WHERE id = ?", videoID).Scan(&vID, &vStatus)
			if vErr == nil {
				titleFound = true
				requiredTier = models.TierFree // default for custom uploaded videos unless specified
			}
		}
	}

	if !titleFound {
		http.Error(w, `{"error":"video not found"}`, http.StatusNotFound)
		return
	}

	// Entitlement verification
	allowed := false
	if requiredTier == models.TierFree {
		allowed = true
	} else if requiredTier == models.TierStandard {
		allowed = (userTier == models.TierStandard || userTier == models.TierPremium)
	} else if requiredTier == models.TierPremium {
		allowed = (userTier == models.TierPremium)
	}

	if !allowed {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":         "tier_upgrade_required",
			"required_tier": requiredTier,
			"current_tier":  userTier,
			"message":       "Upgrade your subscription to watch this title.",
		})
		return
	}

	// 3. Device Registration Check (Max 5 devices per user)
	now := time.Now()
	var registeredDeviceID string
	err = database.DB.QueryRowContext(r.Context(), "SELECT device_id FROM user_devices WHERE user_id = ? AND device_id = ?", claims.UserID, deviceID).Scan(&registeredDeviceID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Check total registered devices
			var count int
			_ = database.DB.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM user_devices WHERE user_id = ?", claims.UserID).Scan(&count)
			if count >= models.MaxDevicesPerUser {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"error":   "device_limit_exceeded",
					"message": fmt.Sprintf("Maximum device limit of %d devices reached for your account.", models.MaxDevicesPerUser),
				})
				return
			}

			// Register new device
			newDevID := uuid.NewString()
			_, _ = database.DB.ExecContext(r.Context(),
				"INSERT INTO user_devices (id, user_id, device_id, device_name, client_type, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				newDevID, claims.UserID, deviceID, clientType+" device", clientType, now, now,
			)
		}
	} else {
		// Update last used
		_, _ = database.DB.ExecContext(r.Context(), "UPDATE user_devices SET last_used_at = ? WHERE user_id = ? AND device_id = ?", now, claims.UserID, deviceID)
	}

	// 4. Concurrent Stream Limit Check (60s heartbeat window)
	maxConcurrentStreams := models.MaxStreamsFree
	switch userTier {
	case models.TierStandard:
		maxConcurrentStreams = models.MaxStreamsStandard
	case models.TierPremium:
		maxConcurrentStreams = models.MaxStreamsPremium
	}

	cutoff := now.Add(-60 * time.Second)
	var activeOtherStreams int
	_ = database.DB.QueryRowContext(r.Context(),
		"SELECT COUNT(DISTINCT session_id) FROM playback_sessions WHERE user_id = ? AND last_heartbeat_at >= ? AND device_id != ?",
		claims.UserID, cutoff, deviceID,
	).Scan(&activeOtherStreams)

	if activeOtherStreams >= maxConcurrentStreams {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "concurrent_stream_limit_exceeded",
			"limit":   maxConcurrentStreams,
			"active":  activeOtherStreams,
			"message": "Concurrent stream limit reached. Please pause playback on other devices to continue.",
		})
		return
	}

	// Register or touch active stream session
	sessionID := uuid.NewString()
	if database.DriverName == "sqlite" {
		_, _ = database.DB.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO playback_sessions (session_id, user_id, device_id, video_id, last_heartbeat_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			sessionID, claims.UserID, deviceID, videoID, now, now,
		)
	} else {
		_, _ = database.DB.ExecContext(r.Context(),
			"INSERT INTO playback_sessions (session_id, user_id, device_id, video_id, last_heartbeat_at, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_heartbeat_at = VALUES(last_heartbeat_at)",
			sessionID, claims.UserID, deviceID, videoID, now, now,
		)
	}

	// 5. Calculate Max Height
	// Mobile caps at 1080p by default; web caps at 2160p (Premium) or 1080p (Standard) or 720p (Free)
	maxHeight := 1080
	if clientType == "mobile" {
		maxHeight = 1080
	} else {
		if userTier == models.TierPremium {
			maxHeight = 2160
		} else if userTier == models.TierStandard {
			maxHeight = 1080
		} else {
			maxHeight = 720
		}
	}

	// 6. Resume Position
	var resumeSec float64
	_ = database.DB.QueryRowContext(r.Context(),
		"SELECT time_seconds FROM watch_progress WHERE user_id = ? AND title_id = ?",
		claims.UserID, videoID,
	).Scan(&resumeSec)

	// 7. Generate Signed Playback Token (5 minutes lifetime)
	playbackToken, err := playback.GeneratePlaybackToken(claims.UserID, videoID, deviceID, clientType, maxHeight, 5*time.Minute)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed generating playback token: %v"}`, err), http.StatusInternalServerError)
		return
	}

	manifestURL := fmt.Sprintf("/api/videos/%s/master.m3u8?token=%s", videoID, playbackToken)

	// Check if S3 CMAF transcoded master.m3u8 actually exists in storage
	storageSvc := storage.GetGlobalStorage()
	hasHLS := false
	if storageSvc != nil {
		masterKey := fmt.Sprintf("videos/%s/master.m3u8", videoID)
		exists, checkErr := storageSvc.ObjectExists(r.Context(), storageSvc.HLSBucket(), masterKey)
		if checkErr == nil && exists {
			hasHLS = true
		}
	}

	if !hasHLS {
		// Fallback to configured direct video_url or trailer (e.g. uploaded video or MP4 stream)
		if titleVideoURL.Valid && strings.TrimSpace(titleVideoURL.String) != "" {
			manifestURL = strings.TrimSpace(titleVideoURL.String)
		} else if titleTrailer.Valid && strings.TrimSpace(titleTrailer.String) != "" {
			manifestURL = strings.TrimSpace(titleTrailer.String)
		} else {
			manifestURL = fmt.Sprintf("/trailers/%s.mp4", videoID)
		}
	}

	resp := models.PlaybackTicketResponse{
		ManifestURL:       manifestURL,
		MaxHeight:         maxHeight,
		ResumePositionSec: resumeSec,
	}

	metrics.RecordPlaybackStart(clientType, maxHeight, string(userTier))
	log.Printf("[Playback METRIC] User: %s | Video: %s | Device: %s | Client: %s | MaxHeight: %dp | Tier: %s",
		claims.UserID, videoID, deviceID, clientType, maxHeight, userTier)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// GetMasterPlaylist handles GET /videos/{id}/master.m3u8 (and /api/videos/{id}/master.m3u8).
// Validates signed token, fetches master.m3u8 from S3, filters rungs > maxHeight, and rewrites sub-playlists.
func GetMasterPlaylist(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	tokenStr := extractToken(r)

	claims, err := playback.ValidatePlaybackToken(tokenStr)
	if err != nil || claims.VideoID != videoID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "invalid or expired playback token",
		})
		return
	}

	storageSvc := storage.GetGlobalStorage()
	if storageSvc == nil {
		http.Error(w, `{"error":"storage unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	masterKey := fmt.Sprintf("videos/%s/master.m3u8", videoID)
	rawBytes, err := storageSvc.FetchObjectBytes(r.Context(), storageSvc.HLSBucket(), masterKey)
	if err != nil {
		http.Error(w, `{"error":"master playlist not found"}`, http.StatusNotFound)
		return
	}

	apiBase := getAPIBaseURL(r)
	rewritten := playback.RewriteMasterPlaylist(rawBytes, videoID, tokenStr, claims.MaxHeight, apiBase)

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	_, _ = w.Write([]byte(rewritten))
}

// GetRenditionPlaylist handles GET /videos/{id}/{rendition}.m3u8.
// Fetches media playlist from S3 and rewrites segment URLs and init.mp4 into 5-minute presigned S3 URLs.
func GetRenditionPlaylist(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	rendition := chi.URLParam(r, "rendition")
	tokenStr := extractToken(r)

	claims, err := playback.ValidatePlaybackToken(tokenStr)
	if err != nil || claims.VideoID != videoID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "invalid or expired playback token",
		})
		return
	}

	storageSvc := storage.GetGlobalStorage()
	if storageSvc == nil {
		http.Error(w, `{"error":"storage unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	// Normalize playlist filename
	if !strings.HasSuffix(rendition, ".m3u8") {
		rendition += ".m3u8"
	}

	playlistKey := fmt.Sprintf("videos/%s/%s", videoID, rendition)
	rawBytes, err := storageSvc.FetchObjectBytes(r.Context(), storageSvc.HLSBucket(), playlistKey)
	if err != nil {
		http.Error(w, `{"error":"rendition playlist not found"}`, http.StatusNotFound)
		return
	}

	enableEncryption := os.Getenv("ENABLE_HLS_ENCRYPTION") == "true"
	apiBase := getAPIBaseURL(r)

	rewritten, err := playback.RewriteRenditionPlaylist(
		r.Context(),
		rawBytes,
		videoID,
		storageSvc,
		tokenStr,
		enableEncryption,
		apiBase,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed rewriting playlist: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	_, _ = w.Write([]byte(rewritten))
}

// SaveWatchProgress handles POST /api/videos/{id}/progress (and /videos/{id}/progress).
// Saves watch progress position every 15s.
func SaveWatchProgress(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.WatchProgressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	profileID := req.ProfileID
	if profileID == "" {
		profileID = "default"
	}

	now := time.Now()
	var err error
	if database.DriverName == "sqlite" {
		query := `INSERT OR REPLACE INTO watch_progress (user_id, profile_id, title_id, episode_id, progress_percent, time_seconds, updated_at) 
		          VALUES (?, ?, ?, '', ?, ?, ?)`
		_, err = database.DB.ExecContext(r.Context(), query, claims.UserID, profileID, videoID, req.ProgressPercent, req.TimeSeconds, now)
	} else {
		query := `INSERT INTO watch_progress (user_id, profile_id, title_id, episode_id, progress_percent, time_seconds, updated_at) 
		          VALUES (?, ?, ?, '', ?, ?, ?) 
		          ON DUPLICATE KEY UPDATE progress_percent = VALUES(progress_percent), time_seconds = VALUES(time_seconds), updated_at = VALUES(updated_at)`
		_, err = database.DB.ExecContext(r.Context(), query, claims.UserID, profileID, videoID, req.ProgressPercent, req.TimeSeconds, now)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"video_id":         videoID,
		"time_seconds":     req.TimeSeconds,
		"progress_percent": req.ProgressPercent,
	})
}

// SendStreamHeartbeat handles POST /api/videos/{id}/heartbeat (and /videos/{id}/heartbeat).
// Refreshes active playback session heartbeat for concurrent stream counting.
func SendStreamHeartbeat(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.StreamHeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		req.SessionID = uuid.NewString()
	}

	now := time.Now()
	var err error
	if database.DriverName == "sqlite" {
		_, err = database.DB.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO playback_sessions (session_id, user_id, device_id, video_id, last_heartbeat_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			req.SessionID, claims.UserID, req.DeviceID, videoID, now, now,
		)
	} else {
		_, err = database.DB.ExecContext(r.Context(),
			"INSERT INTO playback_sessions (session_id, user_id, device_id, video_id, last_heartbeat_at, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_heartbeat_at = VALUES(last_heartbeat_at)",
			req.SessionID, claims.UserID, req.DeviceID, videoID, now, now,
		)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"session_id": req.SessionID,
	})
}

// GetHLSKey handles GET /videos/{id}/key.
// Serves AES-128 16-byte encryption key for authenticated clients with valid playback token.
func GetHLSKey(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	tokenStr := extractToken(r)

	claims, err := playback.ValidatePlaybackToken(tokenStr)
	if err != nil || claims.VideoID != videoID {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Deterministic 16-byte key derived from video ID + JWTSecret
	h := sha256.New()
	h.Write([]byte(videoID))
	h.Write(middleware.JWTSecret)
	fullKey := h.Sum(nil)
	aesKey := fullKey[:16]

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	_, _ = w.Write(aesKey)
}

func extractToken(r *http.Request) string {
	if t := r.URL.Query().Get("token"); t != "" {
		return t
	}
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func getAPIBaseURL(r *http.Request) string {
	// Detect public base
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	if host == "" {
		host = "localhost:8081"
	}
	return fmt.Sprintf("%s://%s/api", scheme, host)
}
