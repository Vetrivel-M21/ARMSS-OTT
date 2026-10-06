package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"

	"github.com/go-chi/chi/v5"
)

type ToggleWatchlistRequest struct {
	ProfileID string `json:"profile_id"`
	TitleID   string `json:"title_id"`
}

type HeartbeatRequest struct {
	ProfileID       string  `json:"profile_id"`
	TitleID         string  `json:"title_id"`
	EpisodeID       string  `json:"episode_id,omitempty"`
	ProgressPercent float64 `json:"progress_percent"`
	TimeSeconds     float64 `json:"time_seconds"`
}

type RatingRequest struct {
	TitleID string `json:"title_id"`
	Score   int    `json:"score"` // 1, -1, or 0 to clear
}

func GetWatchlist(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	profileID := r.URL.Query().Get("profile_id")
	if profileID == "" {
		profileID = "default"
	}

	rows, err := database.DB.Query(
		"SELECT title_id FROM watchlist WHERE user_id = ? AND profile_id = ? ORDER BY added_at DESC",
		claims.UserID, profileID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed fetching watchlist"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	titleIDs := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			titleIDs = append(titleIDs, id)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title_ids": titleIDs,
	})
}

func ToggleWatchlist(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req ToggleWatchlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ProfileID == "" {
		req.ProfileID = "default"
	}

	var exists int
	_ = database.DB.QueryRow(
		"SELECT COUNT(*) FROM watchlist WHERE user_id = ? AND profile_id = ? AND title_id = ?",
		claims.UserID, req.ProfileID, req.TitleID,
	).Scan(&exists)

	now := time.Now()
	isInList := false
	if exists > 0 {
		_, _ = database.DB.Exec(
			"DELETE FROM watchlist WHERE user_id = ? AND profile_id = ? AND title_id = ?",
			claims.UserID, req.ProfileID, req.TitleID,
		)
		isInList = false
	} else {
		_, _ = database.DB.Exec(
			"INSERT INTO watchlist (user_id, profile_id, title_id, added_at) VALUES (?, ?, ?, ?)",
			claims.UserID, req.ProfileID, req.TitleID, now,
		)
		isInList = true
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title_id":   req.TitleID,
		"in_list":    isInList,
		"profile_id": req.ProfileID,
	})
}

func GetProgress(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	profileID := r.URL.Query().Get("profile_id")
	if profileID == "" {
		profileID = "default"
	}

	rows, err := database.DB.Query(
		"SELECT user_id, profile_id, title_id, episode_id, progress_percent, time_seconds, updated_at FROM watch_progress WHERE user_id = ? AND profile_id = ? ORDER BY updated_at DESC",
		claims.UserID, profileID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed fetching progress"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.WatchProgress{}
	for rows.Next() {
		var wp models.WatchProgress
		var epID sql.NullString
		if err := rows.Scan(&wp.UserID, &wp.ProfileID, &wp.TitleID, &epID, &wp.ProgressPercent, &wp.TimeSeconds, &wp.UpdatedAt); err == nil {
			if epID.Valid {
				wp.EpisodeID = epID.String
			}
			items = append(items, wp)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"items": items,
	})
}

func HeartbeatProgress(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ProfileID == "" {
		req.ProfileID = "default"
	}

	now := time.Now()

	// Check if entry exists
	var exists int
	_ = database.DB.QueryRow(
		"SELECT COUNT(*) FROM watch_progress WHERE user_id = ? AND profile_id = ? AND title_id = ?",
		claims.UserID, req.ProfileID, req.TitleID,
	).Scan(&exists)

	if exists > 0 {
		_, _ = database.DB.Exec(
			"UPDATE watch_progress SET episode_id = ?, progress_percent = ?, time_seconds = ?, updated_at = ? WHERE user_id = ? AND profile_id = ? AND title_id = ?",
			req.EpisodeID, req.ProgressPercent, req.TimeSeconds, now, claims.UserID, req.ProfileID, req.TitleID,
		)
	} else {
		_, _ = database.DB.Exec(
			"INSERT INTO watch_progress (user_id, profile_id, title_id, episode_id, progress_percent, time_seconds, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			claims.UserID, req.ProfileID, req.TitleID, req.EpisodeID, req.ProgressPercent, req.TimeSeconds, now,
		)
	}

	// Update user's last_active_at and record watch activity
	_, _ = database.DB.Exec("UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ?", now, now, claims.UserID)
	_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'watch', ?, ?)",
		now.Format("20060102150405")+"-"+claims.UserID[:8],
		claims.UserID,
		req.TitleID,
		now,
	)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"saved":  true,
	})
}

func SetRating(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req RatingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	now := time.Now()
	if req.Score == 0 {
		_, _ = database.DB.Exec("DELETE FROM ratings WHERE user_id = ? AND title_id = ?", claims.UserID, req.TitleID)
	} else {
		var exists int
		_ = database.DB.QueryRow("SELECT COUNT(*) FROM ratings WHERE user_id = ? AND title_id = ?", claims.UserID, req.TitleID).Scan(&exists)
		if exists > 0 {
			_, _ = database.DB.Exec("UPDATE ratings SET score = ?, updated_at = ? WHERE user_id = ? AND title_id = ?", req.Score, now, claims.UserID, req.TitleID)
		} else {
			_, _ = database.DB.Exec("INSERT INTO ratings (user_id, title_id, score, updated_at) VALUES (?, ?, ?, ?)", claims.UserID, req.TitleID, req.Score, now)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title_id": req.TitleID,
		"score":    req.Score,
	})
}

// GetHistory returns chronological viewing history for the authenticated user
func GetHistory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	profileID := r.URL.Query().Get("profile_id")

	query := `
		SELECT 
			wp.title_id,
			COALESCE(t.title, wp.title_id) as title,
			COALESCE(t.poster, '') as poster,
			COALESCE(t.backdrop, '') as backdrop,
			COALESCE(t.kind, 'film') as kind,
			COALESCE(t.runtime_min, 0) as runtime_min,
			COALESCE(wp.episode_id, '') as episode_id,
			wp.progress_percent,
			wp.time_seconds,
			wp.updated_at
		FROM watch_progress wp
		LEFT JOIN titles t ON wp.title_id = t.id
		WHERE wp.user_id = ?
	`
	args := []interface{}{claims.UserID}
	if profileID != "" && profileID != "all" {
		query += " AND wp.profile_id = ?"
		args = append(args, profileID)
	}
	query += " ORDER BY wp.updated_at DESC LIMIT 100"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"failed fetching history"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]models.HistoryItem, 0)
	for rows.Next() {
		var h models.HistoryItem
		if err := rows.Scan(
			&h.TitleID,
			&h.Title,
			&h.Poster,
			&h.Backdrop,
			&h.Kind,
			&h.RuntimeMin,
			&h.EpisodeID,
			&h.ProgressPercent,
			&h.TimeSeconds,
			&h.UpdatedAt,
		); err == nil {
			h.ProgressPercent = float64(int(h.ProgressPercent*10)) / 10.0
			items = append(items, h)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"items": items,
		"count": len(items),
	})
}

// DeleteHistoryItem removes a specific title from the user's viewing history
func DeleteHistoryItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	titleID := chi.URLParam(r, "id")
	if titleID == "" {
		http.Error(w, `{"error":"title id required"}`, http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec("DELETE FROM watch_progress WHERE user_id = ? AND title_id = ?", claims.UserID, titleID)
	if err != nil {
		http.Error(w, `{"error":"failed removing title from history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"title_id": titleID,
	})
}

// ClearHistory deletes all watch progress history for the current user
func ClearHistory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	_, err := database.DB.Exec("DELETE FROM watch_progress WHERE user_id = ?", claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"failed clearing history"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

