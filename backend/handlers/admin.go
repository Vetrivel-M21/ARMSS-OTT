package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

var nonAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)

func sanitizeTitleSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = nonAlphaNumRegex.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 60 {
		s = s[:60]
		s = strings.TrimRight(s, "-")
	}
	if s == "" {
		s = "title-" + uuid.New().String()[:8]
	}
	return s
}

// AdminListUsers — GET /api/admin/users
// Returns paginated list of all users with optional search and tier filter
func AdminListUsers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	tierFilter := r.URL.Query().Get("tier")

	query := `SELECT id, email, name, subscription_tier, is_admin, created_at, updated_at FROM users`
	var args []interface{}
	var conditions []string

	if search != "" {
		conditions = append(conditions, `(email LIKE ? OR name LIKE ?)`)
		like := "%" + search + "%"
		args = append(args, like, like)
	}
	if tierFilter != "" && tierFilter != "all" {
		conditions = append(conditions, `subscription_tier = ?`)
		args = append(args, tierFilter)
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY created_at DESC LIMIT 200"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		_ = rows.Scan(&u.ID, &u.Email, &u.Name, &u.SubscriptionTier, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt)
		users = append(users, u)
	}
	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

// AdminUpdateUserSubscription — PUT /api/admin/users/{id}/subscription
func AdminUpdateUserSubscription(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	var req struct {
		Tier models.SubscriptionTier `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if req.Tier != models.TierFree && req.Tier != models.TierStandard && req.Tier != models.TierPremium {
		http.Error(w, `{"error":"invalid tier"}`, http.StatusBadRequest)
		return
	}
	now := time.Now()
	_, err := database.DB.Exec("UPDATE users SET subscription_tier = ?, updated_at = ? WHERE id = ?", string(req.Tier), now, userID)
	if err != nil {
		http.Error(w, `{"error":"update failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "tier": req.Tier})
}

// AdminBanUser — PUT /api/admin/users/{id}/ban
func AdminBanUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	var req struct {
		Banned bool `json:"banned"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	now := time.Now()
	var tier string
	if req.Banned {
		tier = "banned"
	} else {
		tier = "free"
	}
	_, err := database.DB.Exec("UPDATE users SET subscription_tier = ?, updated_at = ? WHERE id = ?", tier, now, userID)
	if err != nil {
		http.Error(w, `{"error":"update failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "banned": req.Banned})
}

// AdminListTitles — GET /api/admin/titles
func AdminListTitles(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges FROM titles ORDER BY title`)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var titles []models.Title
	for rows.Next() {
		var t models.Title
		var genresStr, badgesStr string
		var trailer sql.NullString
		_ = rows.Scan(&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin, &t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop, &trailer, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier, &genresStr, &badgesStr)
		if trailer.Valid {
			t.Trailer = trailer.String
		}
		if genresStr != "" {
			t.Genres = strings.Split(genresStr, ",")
		}
		if badgesStr != "" {
			t.Badges = strings.Split(badgesStr, ",")
		}
		titles = append(titles, t)
	}
	if titles == nil {
		titles = []models.Title{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"titles": titles, "count": len(titles)})
}

// AdminGetTitle — GET /api/admin/titles/{id}
func AdminGetTitle(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	var t models.Title
	var genresStr, badgesStr string
	var trailer sql.NullString

	err := database.DB.QueryRow(
		`SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges
		 FROM titles WHERE id = ?`,
		titleID,
	).Scan(
		&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin, &t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop, &trailer, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier, &genresStr, &badgesStr,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"title not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if trailer.Valid {
		t.Trailer = trailer.String
	}
	if genresStr != "" {
		t.Genres = strings.Split(genresStr, ",")
	}
	if badgesStr != "" {
		t.Badges = strings.Split(badgesStr, ",")
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(t)
}

// AdminUpdateTitle — PUT /api/admin/titles/{id}
func AdminUpdateTitle(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	var req struct {
		Title        *string                  `json:"title"`
		Kind         *string                  `json:"kind"`
		Year         *int                     `json:"year"`
		Maturity     *string                  `json:"maturity"`
		RuntimeMin   *int                     `json:"runtime_min"`
		MatchPercent *int                     `json:"match_percent"`
		Logline      *string                  `json:"logline"`
		Synopsis     *string                  `json:"synopsis"`
		Poster       *string                  `json:"poster"`
		Backdrop     *string                  `json:"backdrop"`
		Trailer      *string                  `json:"trailer"`
		VideoURL     *string                  `json:"video_url"`
		Tone         *string                  `json:"tone"`
		Original     *bool                    `json:"original"`
		Kids         *bool                    `json:"kids"`
		RequiredTier *models.SubscriptionTier `json:"required_tier"`
		Genres       []string                 `json:"genres"`
		Badges       []string                 `json:"badges"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	var setClauses []string
	var args []interface{}

	if req.Title != nil {
		setClauses = append(setClauses, "title = ?")
		args = append(args, *req.Title)
	}
	if req.Kind != nil {
		setClauses = append(setClauses, "kind = ?")
		args = append(args, *req.Kind)
	}
	if req.Year != nil {
		setClauses = append(setClauses, "year = ?")
		args = append(args, *req.Year)
	}
	if req.Maturity != nil {
		setClauses = append(setClauses, "maturity = ?")
		args = append(args, *req.Maturity)
	}
	if req.RuntimeMin != nil {
		setClauses = append(setClauses, "runtime_min = ?")
		args = append(args, *req.RuntimeMin)
	}
	if req.MatchPercent != nil {
		setClauses = append(setClauses, "match_percent = ?")
		args = append(args, *req.MatchPercent)
	}
	if req.Logline != nil {
		setClauses = append(setClauses, "logline = ?")
		args = append(args, *req.Logline)
	}
	if req.Synopsis != nil {
		setClauses = append(setClauses, "synopsis = ?")
		args = append(args, *req.Synopsis)
	}
	if req.Poster != nil {
		setClauses = append(setClauses, "poster = ?")
		args = append(args, *req.Poster)
	}
	if req.Backdrop != nil {
		setClauses = append(setClauses, "backdrop = ?")
		args = append(args, *req.Backdrop)
	}
	if req.Trailer != nil {
		setClauses = append(setClauses, "trailer = ?")
		args = append(args, *req.Trailer)
	}
	if req.VideoURL != nil {
		setClauses = append(setClauses, "video_url = ?")
		args = append(args, *req.VideoURL)
	}
	if req.Tone != nil {
		setClauses = append(setClauses, "tone = ?")
		args = append(args, *req.Tone)
	}
	if req.Original != nil {
		setClauses = append(setClauses, "original = ?")
		args = append(args, *req.Original)
	}
	if req.Kids != nil {
		setClauses = append(setClauses, "kids = ?")
		args = append(args, *req.Kids)
	}
	if req.RequiredTier != nil {
		setClauses = append(setClauses, "required_tier = ?")
		args = append(args, string(*req.RequiredTier))
	}
	if req.Genres != nil {
		setClauses = append(setClauses, "genres = ?")
		args = append(args, strings.Join(req.Genres, ","))
	}
	if req.Badges != nil {
		setClauses = append(setClauses, "badges = ?")
		args = append(args, strings.Join(req.Badges, ","))
	}

	if len(setClauses) == 0 {
		http.Error(w, `{"error":"no fields to update"}`, http.StatusBadRequest)
		return
	}

	args = append(args, titleID)
	query := "UPDATE titles SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
	_, err := database.DB.Exec(query, args...)
	if err != nil {
		http.Error(w, `{"error":"update failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": titleID})
}

// AdminCreateTitle — POST /api/admin/titles
func AdminCreateTitle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		models.Title
		MatchPercent *int `json:"match_percent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	t := req.Title
	if req.MatchPercent != nil && *req.MatchPercent > 0 && t.Match == 0 {
		t.Match = *req.MatchPercent
	}

	if strings.TrimSpace(t.Title) == "" {
		http.Error(w, `{"error":"title name is required"}`, http.StatusBadRequest)
		return
	}

	if t.ID == "" {
		t.ID = sanitizeTitleSlug(t.Title)
	} else {
		t.ID = sanitizeTitleSlug(t.ID)
	}

	// Prevent Primary Key Duplicate Collision in MySQL/SQLite
	var count int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE id = ?", t.ID).Scan(&count)
	if count > 0 {
		t.ID = fmt.Sprintf("%s-%s", t.ID, uuid.New().String()[:6])
	}

	if t.RequiredTier == "" {
		t.RequiredTier = models.TierFree
	}
	if t.Maturity == "" {
		t.Maturity = "U"
	}
	if t.Kind == "" {
		t.Kind = "film"
	}
	if t.Year == 0 {
		t.Year = time.Now().Year()
	}
	if t.RuntimeMin == 0 {
		t.RuntimeMin = 120
	}
	if t.Match == 0 {
		t.Match = 95
	}
	if t.Tone == "" {
		t.Tone = "ember"
	}
	if t.Poster == "" {
		t.Poster = "/posters/default.jpg"
	}
	if t.Backdrop == "" {
		t.Backdrop = t.Poster
	}
	if t.Logline == "" {
		t.Logline = t.Title
	}
	if t.Synopsis == "" {
		t.Synopsis = t.Logline
	}

	genresStr := strings.Join(t.Genres, ",")
	badgesStr := strings.Join(t.Badges, ",")

	_, err := database.DB.Exec(
		`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, video_url, tone, original, kids, required_tier, genres, badges)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Title, t.Kind, t.Year, t.Maturity, t.RuntimeMin, t.Match, t.Logline, t.Synopsis, t.Poster, t.Backdrop, t.Trailer, t.VideoURL, t.Tone, t.Original, t.Kids, string(t.RequiredTier), genresStr, badgesStr,
	)
	if err != nil {
		// Fallback without video_url if table column missing
		_, err = database.DB.Exec(
			`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			t.ID, t.Title, t.Kind, t.Year, t.Maturity, t.RuntimeMin, t.Match, t.Logline, t.Synopsis, t.Poster, t.Backdrop, t.Trailer, t.Tone, t.Original, t.Kids, string(t.RequiredTier), genresStr, badgesStr,
		)
		if err != nil {
			log.Printf("[AdminCreateTitle] Failed inserting title %q (ID: %s): %v", t.Title, t.ID, err)
			http.Error(w, `{"error":"failed creating title: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "title": t})
}

// AdminListEpisodes — GET /api/admin/titles/{id}/episodes
func AdminListEpisodes(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	episodes := []models.Episode{}
	rows, err := database.DB.Query(
		"SELECT id, title_id, season_number, episode_number, title, runtime_min, synopsis, video_url, thumbnail_url, created_at FROM episodes WHERE title_id = ? ORDER BY season_number ASC, episode_number ASC",
		titleID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ep models.Episode
			var thumb sql.NullString
			if err := rows.Scan(&ep.ID, &ep.TitleID, &ep.SeasonNumber, &ep.EpisodeNumber, &ep.Title, &ep.RuntimeMin, &ep.Synopsis, &ep.VideoURL, &thumb, &ep.CreatedAt); err == nil {
				if thumb.Valid {
					ep.ThumbnailURL = thumb.String
				}
				episodes = append(episodes, ep)
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"episodes": episodes})
}

// AdminCreateEpisode — POST /api/admin/titles/{id}/episodes
func AdminCreateEpisode(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	var ep models.Episode
	if err := json.NewDecoder(r.Body).Decode(&ep); err != nil {
		http.Error(w, `{"error":"invalid request body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(ep.Title) == "" {
		http.Error(w, `{"error":"episode title is required"}`, http.StatusBadRequest)
		return
	}
	if ep.ID == "" {
		ep.ID = fmt.Sprintf("%s-s%de%d-%s", titleID, ep.SeasonNumber, ep.EpisodeNumber, uuid.New().String()[:6])
	}
	if ep.SeasonNumber <= 0 {
		ep.SeasonNumber = 1
	}
	if ep.EpisodeNumber <= 0 {
		ep.EpisodeNumber = 1
	}
	ep.TitleID = titleID
	ep.CreatedAt = time.Now()

	_, err := database.DB.Exec(
		`INSERT INTO episodes (id, title_id, season_number, episode_number, title, runtime_min, synopsis, video_url, thumbnail_url, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		ep.ID, ep.TitleID, ep.SeasonNumber, ep.EpisodeNumber, ep.Title, ep.RuntimeMin, ep.Synopsis, ep.VideoURL, ep.ThumbnailURL, ep.CreatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"failed creating episode: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "episode": ep})
}

// AdminUpdateEpisode — PUT /api/admin/episodes/{episodeId}
func AdminUpdateEpisode(w http.ResponseWriter, r *http.Request) {
	episodeID := chi.URLParam(r, "episodeId")
	var req struct {
		SeasonNumber  *int    `json:"season_number"`
		EpisodeNumber *int    `json:"episode_number"`
		Title         *string `json:"title"`
		RuntimeMin    *int    `json:"runtime_min"`
		Synopsis      *string `json:"synopsis"`
		VideoURL      *string `json:"video_url"`
		ThumbnailURL  *string `json:"thumbnail_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	var setClauses []string
	var args []interface{}
	if req.SeasonNumber != nil {
		setClauses = append(setClauses, "season_number = ?")
		args = append(args, *req.SeasonNumber)
	}
	if req.EpisodeNumber != nil {
		setClauses = append(setClauses, "episode_number = ?")
		args = append(args, *req.EpisodeNumber)
	}
	if req.Title != nil {
		setClauses = append(setClauses, "title = ?")
		args = append(args, *req.Title)
	}
	if req.RuntimeMin != nil {
		setClauses = append(setClauses, "runtime_min = ?")
		args = append(args, *req.RuntimeMin)
	}
	if req.Synopsis != nil {
		setClauses = append(setClauses, "synopsis = ?")
		args = append(args, *req.Synopsis)
	}
	if req.VideoURL != nil {
		setClauses = append(setClauses, "video_url = ?")
		args = append(args, *req.VideoURL)
	}
	if req.ThumbnailURL != nil {
		setClauses = append(setClauses, "thumbnail_url = ?")
		args = append(args, *req.ThumbnailURL)
	}

	if len(setClauses) > 0 {
		args = append(args, episodeID)
		query := "UPDATE episodes SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
		if _, err := database.DB.Exec(query, args...); err != nil {
			http.Error(w, `{"error":"update episode failed: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "id": episodeID})
}

// AdminDeleteEpisode — DELETE /api/admin/episodes/{episodeId}
func AdminDeleteEpisode(w http.ResponseWriter, r *http.Request) {
	episodeID := chi.URLParam(r, "episodeId")
	_, err := database.DB.Exec("DELETE FROM episodes WHERE id = ?", episodeID)
	if err != nil {
		http.Error(w, `{"error":"failed deleting episode"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// AdminDeleteTitle — DELETE /api/admin/titles/{id}
func AdminDeleteTitle(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	// Clean up related records
	_, _ = database.DB.Exec("DELETE FROM watchlist WHERE title_id = ?", titleID)
	_, _ = database.DB.Exec("DELETE FROM watch_progress WHERE title_id = ?", titleID)
	_, _ = database.DB.Exec("DELETE FROM ratings WHERE title_id = ?", titleID)

	_, err := database.DB.Exec("DELETE FROM titles WHERE id = ?", titleID)
	if err != nil {
		http.Error(w, `{"error":"failed deleting title"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// AdminGetAnalytics — GET /api/admin/analytics
func AdminGetAnalytics(w http.ResponseWriter, r *http.Request) {
	var totalUsers, freeCount, standardCount, premiumCount, adminCount, bannedCount int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&totalUsers)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE subscription_tier = 'free'").Scan(&freeCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE subscription_tier = 'standard'").Scan(&standardCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE subscription_tier = 'premium'").Scan(&premiumCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE subscription_tier = 'banned'").Scan(&bannedCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE is_admin = 1 OR is_admin = true").Scan(&adminCount)

	var totalTitles, filmCount, seriesCount, liveCount, originalCount, kidsCount int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles").Scan(&totalTitles)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE kind = 'film'").Scan(&filmCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE kind = 'series'").Scan(&seriesCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE kind = 'live'").Scan(&liveCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE original = 1").Scan(&originalCount)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE kids = 1").Scan(&kidsCount)

	var freeTitles, standardTitles, premiumTitles int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE required_tier = 'free'").Scan(&freeTitles)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE required_tier = 'standard'").Scan(&standardTitles)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM titles WHERE required_tier = 'premium'").Scan(&premiumTitles)

	var totalWatchlistEntries, totalProgressEntries int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM watchlist").Scan(&totalWatchlistEntries)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM watch_progress").Scan(&totalProgressEntries)

	// Monthly revenue estimate (INR)
	revenueEstimate := (standardCount * 99) + (premiumCount * 199)

	// New signups in last 30 days
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	var newSignups int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE created_at > ?", thirtyDaysAgo).Scan(&newSignups)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"total_users":           totalUsers,
		"free_count":            freeCount,
		"standard_count":        standardCount,
		"premium_count":         premiumCount,
		"admin_count":           adminCount,
		"banned_count":          bannedCount,
		"total_titles":          totalTitles,
		"film_count":            filmCount,
		"series_count":          seriesCount,
		"live_count":            liveCount,
		"original_count":        originalCount,
		"kids_count":            kidsCount,
		"free_titles":           freeTitles,
		"standard_titles":       standardTitles,
		"premium_titles":        premiumTitles,
		"total_watchlist":       totalWatchlistEntries,
		"total_progress":        totalProgressEntries,
		"revenue_estimate_inr":  revenueEstimate,
		"new_signups_30d":       newSignups,
		"driver":                database.DriverName,
		"timestamp":             time.Now().Format(time.RFC3339),
	})
}

// AdminBroadcastNotification — POST /api/admin/notifications
type AdminNotification struct {
	Message string `json:"message"`
	Type    string `json:"type"` // "info", "warning", "success"
	SentAt  string `json:"sent_at,omitempty"`
}

var latestNotification *AdminNotification

func AdminBroadcast(w http.ResponseWriter, r *http.Request) {
	var req AdminNotification
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Message) == "" {
		http.Error(w, `{"error":"message cannot be empty"}`, http.StatusBadRequest)
		return
	}
	if req.Type == "" {
		req.Type = "info"
	}
	req.SentAt = time.Now().Format(time.RFC3339)
	latestNotification = &req
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "notification": latestNotification})
}

func GetNotification(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if latestNotification == nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"notification": nil})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"notification": latestNotification})
}

// AdminDeleteUser — DELETE /api/admin/users/{id}
func AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	claims := middleware.GetUserFromContext(r)
	if claims != nil && claims.UserID == userID {
		http.Error(w, `{"error":"cannot delete your own admin account"}`, http.StatusForbidden)
		return
	}
	// Clean up profiles, watchlist, etc.
	_, _ = database.DB.Exec("DELETE FROM profiles WHERE user_id = ?", userID)
	_, _ = database.DB.Exec("DELETE FROM watchlist WHERE user_id = ?", userID)
	_, _ = database.DB.Exec("DELETE FROM watch_progress WHERE user_id = ?", userID)
	_, _ = database.DB.Exec("DELETE FROM ratings WHERE user_id = ?", userID)

	_, err := database.DB.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// AdminUpload — POST /api/admin/upload
func AdminUpload(w http.ResponseWriter, r *http.Request) {
	// Up to 100 MB for trailers/videos or images
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, `{"error":"file too large or invalid form: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"file parameter missing"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	safeName := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)

	// Determine uploads directory, prioritizing UPLOADS_DIR env var (used in Docker / VPS)
	targetUploadDir := os.Getenv("UPLOADS_DIR")
	if targetUploadDir == "" {
		targetUploadDir = filepath.Join("..", "frontend", "public", "uploads")
		if _, err := os.Stat(filepath.Join("..", "frontend", "public")); err != nil {
			targetUploadDir = filepath.Join("public", "uploads")
		}
	}
	_ = os.MkdirAll(targetUploadDir, 0755)

	dstPath := filepath.Join(targetUploadDir, safeName)
	dst, err := os.Create(dstPath)
	if err != nil {
		targetUploadDir = filepath.Join("public", "uploads")
		_ = os.MkdirAll(targetUploadDir, 0755)
		dstPath = filepath.Join(targetUploadDir, safeName)
		dst, err = os.Create(dstPath)
		if err != nil {
			http.Error(w, `{"error":"failed to create file on disk: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, `{"error":"failed writing file: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// Mirror to frontend public/uploads if running locally in dev
	devFrontendDir := filepath.Join("..", "frontend", "public", "uploads")
	if devFrontendDir != targetUploadDir {
		if _, statErr := os.Stat(filepath.Join("..", "frontend", "public")); statErr == nil {
			_ = os.MkdirAll(devFrontendDir, 0755)
			if bytes, rErr := os.ReadFile(dstPath); rErr == nil {
				_ = os.WriteFile(filepath.Join(devFrontendDir, safeName), bytes, 0644)
			}
		}
	}

	url := "/uploads/" + safeName
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"url":     url,
		"name":    header.Filename,
		"size":    header.Size,
	})
}

const defaultSiteDisplaySettingsJSON = `{
	"navVisibility": {
		"films": true,
		"series": true,
		"live": true,
		"myList": true,
		"comingSoon": true,
		"plans": true
	},
	"homeLayout": {
		"heroTitleId": "auto",
		"heroHeight": "standard",
		"heroAlignment": "left",
		"containerWidth": "fluid",
		"rowOrder": [
			{ "id": "continue", "label": "Continue watching", "visible": true },
			{ "id": "top", "label": "Top 10 on ARMSS Today", "visible": true },
			{ "id": "trend", "label": "Trending Now", "visible": true },
			{ "id": "blockbusters", "label": "Tamil Blockbusters", "visible": true },
			{ "id": "orig", "label": "Only on ARMSS Originals", "visible": true },
			{ "id": "live", "label": "Live Now (Channels)", "visible": true },
			{ "id": "series", "label": "Binge-worthy Web Series", "visible": true },
			{ "id": "fresh", "label": "New & Noteworthy", "visible": true },
			{ "id": "thrill", "label": "Edge-of-your-seat Thrillers", "visible": true },
			{ "id": "drama", "label": "Award-winning Films & Drama", "visible": true },
			{ "id": "scifi", "label": "Action & Sci-Fi", "visible": true },
			{ "id": "films", "label": "All Films Collection", "visible": true },
			{ "id": "list", "label": "My List", "visible": true },
			{ "id": "soon", "label": "Coming Soon", "visible": true }
		]
	}
}`

// GetLayoutSettings — GET /api/settings/layout (Public)
func GetLayoutSettings(w http.ResponseWriter, r *http.Request) {
	val, err := database.GetSetting("home_layout")
	w.Header().Set("Content-Type", "application/json")
	if err != nil || strings.TrimSpace(val) == "" {
		_, _ = w.Write([]byte(`{"success":true,"settings":` + defaultSiteDisplaySettingsJSON + `}`))
		return
	}
	_, _ = w.Write([]byte(`{"success":true,"settings":` + val + `}`))
}

// AdminUpdateLayoutSettings — PUT /api/admin/settings/layout (Admin Only)
func AdminUpdateLayoutSettings(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil || len(body) == 0 {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate JSON structure
	var check map[string]interface{}
	if err := json.Unmarshal(body, &check); err != nil {
		http.Error(w, `{"error":"malformed JSON: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if err := database.SetSetting("home_layout", string(body)); err != nil {
		http.Error(w, `{"error":"failed to persist settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"success":true,"message":"Settings saved successfully"}`))
}

// AdminResetLayoutSettings — DELETE /api/admin/settings/layout (Admin Only)
func AdminResetLayoutSettings(w http.ResponseWriter, r *http.Request) {
	if err := database.SetSetting("home_layout", defaultSiteDisplaySettingsJSON); err != nil {
		http.Error(w, `{"error":"failed to reset settings: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"success":true,"message":"Settings reset to default"}`))
}

