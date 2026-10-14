package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"armss-ott-backend/database"
	"armss-ott-backend/services/access"

	"github.com/go-chi/chi/v5"
)

// AdminPlanDTO represents a plan returned to or updated by an administrator.
type AdminPlanDTO struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	PriceINR          int    `json:"price_inr"`
	BillingPeriod     string `json:"billing_period"`
	DailyMovieLimit   int    `json:"daily_movie_limit"`
	DailyEpisodeLimit int    `json:"daily_episode_limit"`
	MaxQuality        int    `json:"max_quality"`
	MaxDevices        int    `json:"max_devices"`
	RazorpayPlanID    string `json:"razorpay_plan_id"`
	IsActive          bool   `json:"is_active"`
	CreatedAt         string `json:"created_at,omitempty"`
	UpdatedAt         string `json:"updated_at,omitempty"`
}

// TitleAccessDTO represents content tier and free episodes boundary configuration.
type TitleAccessDTO struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Kind         string `json:"kind"`
	RequiredTier string `json:"required_tier"`
	FreeEpisodes int    `json:"free_episodes"`
}

// AdminListPlans handles GET /api/admin/plans.
func AdminListPlans(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, 
		       max_quality, max_devices, razorpay_plan_id, is_active, created_at, updated_at
		FROM plans
		ORDER BY price_inr ASC`

	rows, err := database.DB.QueryContext(r.Context(), query)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed querying plans: %v"}`, err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var plans []AdminPlanDTO
	for rows.Next() {
		var p AdminPlanDTO
		var createdAt, updatedAt sql.NullTime
		if scanErr := rows.Scan(
			&p.ID, &p.Name, &p.PriceINR, &p.BillingPeriod,
			&p.DailyMovieLimit, &p.DailyEpisodeLimit,
			&p.MaxQuality, &p.MaxDevices, &p.RazorpayPlanID, &p.IsActive,
			&createdAt, &updatedAt,
		); scanErr == nil {
			if createdAt.Valid {
				p.CreatedAt = createdAt.Time.Format("2006-01-02 15:04:05")
			}
			if updatedAt.Valid {
				p.UpdatedAt = updatedAt.Time.Format("2006-01-02 15:04:05")
			}
			plans = append(plans, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": plans,
	})
}

// AdminUpdatePlan handles PUT /api/admin/plans/{id}.
func AdminUpdatePlan(w http.ResponseWriter, r *http.Request) {
	planID := chi.URLParam(r, "id")
	if planID == "" {
		http.Error(w, `{"error":"missing plan id"}`, http.StatusBadRequest)
		return
	}

	var req AdminPlanDTO
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON request"}`, http.StatusBadRequest)
		return
	}

	// Check if plan exists
	var exists bool
	err := database.DB.QueryRowContext(r.Context(), "SELECT EXISTS(SELECT 1 FROM plans WHERE id = ?)", planID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"plan not found"}`, http.StatusNotFound)
		return
	}

	query := `
		UPDATE plans 
		SET name = ?, price_inr = ?, billing_period = ?, daily_movie_limit = ?, daily_episode_limit = ?,
		    max_quality = ?, max_devices = ?, razorpay_plan_id = ?, is_active = ?, updated_at = NOW()
		WHERE id = ?`

	_, err = database.DB.ExecContext(r.Context(), query,
		req.Name, req.PriceINR, req.BillingPeriod, req.DailyMovieLimit, req.DailyEpisodeLimit,
		req.MaxQuality, req.MaxDevices, req.RazorpayPlanID, req.IsActive,
		planID,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed updating plan: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Plan updated successfully",
		"plan_id": planID,
	})
}

// AdminGetTitleAccess handles GET /api/admin/titles/{id}/access.
func AdminGetTitleAccess(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	if titleID == "" {
		http.Error(w, `{"error":"missing title id"}`, http.StatusBadRequest)
		return
	}

	var dto TitleAccessDTO
	var reqTier sql.NullString
	query := "SELECT id, title, kind, required_tier, free_episodes FROM titles WHERE id = ?"
	err := database.DB.QueryRowContext(r.Context(), query, titleID).Scan(
		&dto.ID, &dto.Title, &dto.Kind, &reqTier, &dto.FreeEpisodes,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"title not found"}`, http.StatusNotFound)
		} else {
			http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		}
		return
	}

	if reqTier.Valid {
		dto.RequiredTier = reqTier.String
	} else {
		dto.RequiredTier = "free"
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dto)
}

// AdminUpdateTitleAccess handles PUT /api/admin/titles/{id}/access.
func AdminUpdateTitleAccess(w http.ResponseWriter, r *http.Request) {
	titleID := chi.URLParam(r, "id")
	if titleID == "" {
		http.Error(w, `{"error":"missing title id"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		RequiredTier string `json:"required_tier"`
		FreeEpisodes int    `json:"free_episodes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON request"}`, http.StatusBadRequest)
		return
	}

	if req.RequiredTier == "" {
		req.RequiredTier = "free"
	}
	if req.FreeEpisodes < 0 {
		req.FreeEpisodes = 0
	}

	// Check if title exists
	var exists bool
	err := database.DB.QueryRowContext(r.Context(), "SELECT EXISTS(SELECT 1 FROM titles WHERE id = ?)", titleID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"title not found"}`, http.StatusNotFound)
		return
	}

	query := "UPDATE titles SET required_tier = ?, free_episodes = ? WHERE id = ?"
	_, err = database.DB.ExecContext(r.Context(), query, req.RequiredTier, req.FreeEpisodes, titleID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed updating title access: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "success",
		"message":       "Title access updated successfully",
		"title_id":      titleID,
		"required_tier": req.RequiredTier,
		"free_episodes": req.FreeEpisodes,
	})
}

// PublicListPlans handles GET /api/plans.
// Returns active subscription plans dynamically for user checkout/display.
func PublicListPlans(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, 
		       max_quality, max_devices, razorpay_plan_id, is_active
		FROM plans
		WHERE is_active = TRUE
		ORDER BY price_inr ASC`

	rows, err := database.DB.QueryContext(r.Context(), query)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed querying plans: %v"}`, err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var plans []access.Plan
	for rows.Next() {
		var p access.Plan
		if scanErr := rows.Scan(
			&p.ID, &p.Name, &p.PriceINR, &p.BillingPeriod,
			&p.DailyMovieLimit, &p.DailyEpisodeLimit,
			&p.MaxQuality, &p.MaxDevices, &p.RazorpayPlanID, &p.IsActive,
		); scanErr == nil {
			plans = append(plans, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": plans,
	})
}
