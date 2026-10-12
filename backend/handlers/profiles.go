package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ProfileRequest struct {
	Name        string `json:"name"`
	AvatarColor string `json:"avatar_color"`
	IsKids      bool   `json:"is_kids"`
	Pin         string `json:"pin"`
}

// GetProfiles handles GET /api/profiles
func GetProfiles(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	userID := ""
	if claims != nil {
		userID = claims.UserID
	}

	profiles := []models.Profile{}

	if userID != "" {
		rows, err := database.DB.Query(
			"SELECT id, user_id, name, avatar_color, is_kids, pin, created_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC",
			userID,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p models.Profile
				var pin sql.NullString
				if scanErr := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarColor, &p.IsKids, &pin, &p.CreatedAt); scanErr == nil {
					if pin.Valid {
						p.Pin = pin.String
					}
					profiles = append(profiles, p)
				}
			}
		}
	}

	// If no profiles exist yet, create or provide default profiles
	if len(profiles) == 0 {
		now := time.Now()
		defaultUID := userID
		if defaultUID == "" {
			defaultUID = "guest_user"
		}

		p1 := models.Profile{
			ID:          "p_adult_" + uuid.New().String()[:8],
			UserID:      defaultUID,
			Name:        "Member",
			AvatarColor: "#E50914",
			IsKids:      false,
			CreatedAt:   now,
		}
		p2 := models.Profile{
			ID:          "p_kids_" + uuid.New().String()[:8],
			UserID:      defaultUID,
			Name:        "Kids Zone",
			AvatarColor: "#10B981",
			IsKids:      true,
			Pin:         "1234",
			CreatedAt:   now,
		}

		if userID != "" {
			_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", p1.ID, userID, p1.Name, p1.AvatarColor, p1.IsKids, p1.Pin, now)
			_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", p2.ID, userID, p2.Name, p2.AvatarColor, p2.IsKids, p2.Pin, now)
		}

		profiles = append(profiles, p1, p2)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"profiles": profiles,
	})
}

// CreateProfile handles POST /api/profiles
func CreateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req ProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, `{"error":"profile name is required"}`, http.StatusBadRequest)
		return
	}

	if req.AvatarColor == "" {
		req.AvatarColor = "#E50914"
	}

	now := time.Now()
	newProfile := models.Profile{
		ID:          uuid.New().String(),
		UserID:      claims.UserID,
		Name:        req.Name,
		AvatarColor: req.AvatarColor,
		IsKids:      req.IsKids,
		Pin:         req.Pin,
		CreatedAt:   now,
	}

	_, err := database.DB.Exec(
		"INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		newProfile.ID, newProfile.UserID, newProfile.Name, newProfile.AvatarColor, newProfile.IsKids, newProfile.Pin, now,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to create profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(newProfile)
}

// UpdateProfile handles PUT /api/profiles/{id}
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	profileID := chi.URLParam(r, "id")
	var req ProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec(
		"UPDATE profiles SET name = ?, avatar_color = ?, is_kids = ?, pin = ? WHERE id = ? AND user_id = ?",
		req.Name, req.AvatarColor, req.IsKids, req.Pin, profileID, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to update profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

// DeleteProfile handles DELETE /api/profiles/{id}
func DeleteProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	profileID := chi.URLParam(r, "id")
	_, err := database.DB.Exec(
		"DELETE FROM profiles WHERE id = ? AND user_id = ?",
		profileID, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to delete profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}
