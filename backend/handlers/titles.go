package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func ListTitles(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	kidsOnly := r.URL.Query().Get("kids") == "true"

	query := "SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, video_url, tone, original, kids, required_tier, genres, badges FROM titles WHERE 1=1"
	args := []interface{}{}

	if kind != "" {
		query += " AND kind = ?"
		args = append(args, kind)
	}
	if kidsOnly {
		query += " AND kids = 1"
	}

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		// Fallback for older database before video_url migration
		fallbackQuery := "SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges FROM titles WHERE 1=1"
		if kind != "" {
			fallbackQuery += " AND kind = ?"
		}
		if kidsOnly {
			fallbackQuery += " AND kids = 1"
		}
		rows, err = database.DB.Query(fallbackQuery, args...)
		if err != nil {
			http.Error(w, `{"error":"failed querying titles"}`, http.StatusInternalServerError)
			return
		}
	}
	defer rows.Close()

	titles := []models.Title{}
	for rows.Next() {
		var t models.Title
		var genresStr, badgesStr string
		var trailer, videoURL sql.NullString
		cols, _ := rows.Columns()
		if len(cols) >= 19 {
			err = rows.Scan(
				&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin,
				&t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop,
				&trailer, &videoURL, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier,
				&genresStr, &badgesStr,
			)
		} else {
			err = rows.Scan(
				&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin,
				&t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop,
				&trailer, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier,
				&genresStr, &badgesStr,
			)
		}
		if err != nil {
			continue
		}
		if trailer.Valid {
			t.Trailer = trailer.String
		}
		if videoURL.Valid {
			t.VideoURL = videoURL.String
		}
		if genresStr != "" {
			t.Genres = strings.Split(genresStr, ",")
		}
		if badgesStr != "" {
			t.Badges = strings.Split(badgesStr, ",")
		}
		if t.ID == "vikram" {
			t.Featured = true
			t.Trending = true
			r1 := 1
			t.Rank = &r1
		} else if t.ID == "master" {
			t.Featured = true
			t.Trending = true
			r2 := 2
			t.Rank = &r2
		}
		titles = append(titles, t)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"titles": titles,
	})
}

func GetTitle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var t models.Title
	var genresStr, badgesStr string
	var trailer, videoURL sql.NullString

	err := database.DB.QueryRow(
		`SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, video_url, tone, original, kids, required_tier, genres, badges 
		 FROM titles WHERE id = ?`,
		id,
	).Scan(
		&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin,
		&t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop,
		&trailer, &videoURL, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier,
		&genresStr, &badgesStr,
	)

	if err != nil {
		// Fallback query if video_url column is missing
		err = database.DB.QueryRow(
			`SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges 
			 FROM titles WHERE id = ?`,
			id,
		).Scan(
			&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin,
			&t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop,
			&trailer, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier,
			&genresStr, &badgesStr,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, `{"error":"title not found"}`, http.StatusNotFound)
				return
			}
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}
	}
	if trailer.Valid {
		t.Trailer = trailer.String
	}
	if videoURL.Valid {
		t.VideoURL = videoURL.String
	}
	if genresStr != "" {
		t.Genres = strings.Split(genresStr, ",")
	}
	if badgesStr != "" {
		t.Badges = strings.Split(badgesStr, ",")
	}
	if t.ID == "vikram" {
		t.Featured = true
		t.Trending = true
		r1 := 1
		t.Rank = &r1
	} else if t.ID == "master" {
		t.Featured = true
		t.Trending = true
		r2 := 2
		t.Rank = &r2
	}

	// Fetch dynamic episodes if available
	t.Episodes = []models.Episode{}
	epRows, epErr := database.DB.Query(
		"SELECT id, title_id, season_number, episode_number, title, runtime_min, synopsis, video_url, thumbnail_url, created_at FROM episodes WHERE title_id = ? ORDER BY season_number ASC, episode_number ASC",
		id,
	)
	if epErr == nil {
		defer epRows.Close()
		for epRows.Next() {
			var ep models.Episode
			var thumb sql.NullString
			if scanErr := epRows.Scan(&ep.ID, &ep.TitleID, &ep.SeasonNumber, &ep.EpisodeNumber, &ep.Title, &ep.RuntimeMin, &ep.Synopsis, &ep.VideoURL, &thumb, &ep.CreatedAt); scanErr == nil {
				if thumb.Valid {
					ep.ThumbnailURL = thumb.String
				}
				t.Episodes = append(t.Episodes, ep)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(t)
}

// PublicListEpisodes lists all episodes for a specific title
func PublicListEpisodes(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	episodes := []models.Episode{}
	rows, err := database.DB.Query(
		"SELECT id, title_id, season_number, episode_number, title, runtime_min, synopsis, video_url, thumbnail_url, created_at FROM episodes WHERE title_id = ? ORDER BY season_number ASC, episode_number ASC",
		id,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ep models.Episode
			var thumb sql.NullString
			if scanErr := rows.Scan(&ep.ID, &ep.TitleID, &ep.SeasonNumber, &ep.EpisodeNumber, &ep.Title, &ep.RuntimeMin, &ep.Synopsis, &ep.VideoURL, &thumb, &ep.CreatedAt); scanErr == nil {
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

// CheckPlaybackTicket checks entitlement and grants playback session
func CheckPlaybackTicket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := middleware.GetUserFromContext(r)

	// Determine user's active tier (default to free if guest/unauthenticated)
	userTier := models.TierFree
	if claims != nil && claims.SubscriptionTier != "" {
		userTier = claims.SubscriptionTier
	}

	var requiredTier models.SubscriptionTier
	var titleName string
	err := database.DB.QueryRow("SELECT title, required_tier FROM titles WHERE id = ?", id).Scan(&titleName, &requiredTier)
	if err == sql.ErrNoRows {
		// id could be an episode ID
		var parentTitleID string
		epErr := database.DB.QueryRow("SELECT title_id, title FROM episodes WHERE id = ?", id).Scan(&parentTitleID, &titleName)
		if epErr == nil {
			err = database.DB.QueryRow("SELECT required_tier FROM titles WHERE id = ?", parentTitleID).Scan(&requiredTier)
		}
	}
	if err != nil {
		if err == sql.ErrNoRows {
			// If not in database or static catalog, default to Free
			requiredTier = models.TierFree
			titleName = id
		} else {
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}
	}

	if requiredTier == "" {
		requiredTier = models.TierFree
	}

	// Entitlement verification:
	// Premium requires userTier == "premium"
	// Standard requires userTier == "standard" || userTier == "premium"
	// Free is accessible to all
	tierAllowed := false
	if requiredTier == models.TierFree {
		tierAllowed = true
	} else if requiredTier == models.TierStandard {
		tierAllowed = (userTier == models.TierStandard || userTier == models.TierPremium)
	} else if requiredTier == models.TierPremium {
		tierAllowed = (userTier == models.TierPremium)
	}

	if !tierAllowed {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":         "tier_upgrade_required",
			"title":         titleName,
			"required_tier": requiredTier,
			"current_tier":  userTier,
			"message":       "Upgrade your subscription to watch this exclusive title in full quality.",
		})
		return
	}

	// Determine playback parameters based on tier
	maxResolution := "720p"
	adFree := false
	if userTier == models.TierStandard {
		maxResolution = "1080p"
		adFree = true
	} else if userTier == models.TierPremium {
		maxResolution = "4K"
		adFree = true
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"allowed":        true,
		"title_id":       id,
		"user_tier":      userTier,
		"max_resolution": maxResolution,
		"ad_free":        adFree,
		"ticket":         uuid.New().String(),
	})
}

