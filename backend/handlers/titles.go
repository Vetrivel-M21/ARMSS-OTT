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

	query := "SELECT id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges FROM titles WHERE 1=1"
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
		http.Error(w, `{"error":"failed querying titles"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	titles := []models.Title{}
	for rows.Next() {
		var t models.Title
		var genresStr, badgesStr string
		var trailer sql.NullString
		err := rows.Scan(
			&t.ID, &t.Title, &t.Kind, &t.Year, &t.Maturity, &t.RuntimeMin,
			&t.Match, &t.Logline, &t.Synopsis, &t.Poster, &t.Backdrop,
			&trailer, &t.Tone, &t.Original, &t.Kids, &t.RequiredTier,
			&genresStr, &badgesStr,
		)
		if err != nil {
			continue
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
	var trailer sql.NullString

	err := database.DB.QueryRow(
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
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"title not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
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

