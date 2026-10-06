package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
)

type UpgradeRequest struct {
	Tier models.SubscriptionTier `json:"tier"` // "standard" or "premium"
}

func GetPlans(w http.ResponseWriter, r *http.Request) {
	plans := []models.PlanInfo{
		{
			Tier:         models.TierFree,
			Name:         "Free Member",
			PriceMonthly: "₹0",
			PriceAnnual:  "₹0",
			Resolution:   "720p HD",
			Devices:      1,
			AdFree:       false,
			Downloads:    false,
			LiveSports:   false,
			Originals:    false,
		},
		{
			Tier:         models.TierStandard,
			Name:         "Standard Full HD",
			PriceMonthly: "₹99/month",
			PriceAnnual:  "₹79/month (billed annually)",
			Resolution:   "1080p Full HD",
			Devices:      2,
			AdFree:       true,
			Downloads:    false,
			LiveSports:   true,
			Originals:    true,
		},
		{
			Tier:         models.TierPremium,
			Name:         "Premium VIP 4K",
			PriceMonthly: "₹199/month",
			PriceAnnual:  "₹159/month (billed annually)",
			Resolution:   "4K Ultra HD + HDR",
			Devices:      4,
			AdFree:       true,
			Downloads:    true,
			LiveSports:   true,
			Originals:    true,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": plans,
	})
}

func UpgradeSubscription(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req UpgradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Tier != models.TierStandard && req.Tier != models.TierPremium {
		http.Error(w, `{"error":"invalid tier specified (must be standard or premium)"}`, http.StatusBadRequest)
		return
	}

	now := time.Now()
	_, err := database.DB.Exec(
		"UPDATE users SET subscription_tier = ?, updated_at = ? WHERE id = ?",
		string(req.Tier), now, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to update subscription tier"}`, http.StatusInternalServerError)
		return
	}

	// Fetch updated user
	var user models.User
	_ = database.DB.QueryRow(
		"SELECT id, email, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE id = ?",
		claims.UserID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)

	// Issue fresh token with new tier
	newToken, _ := middleware.GenerateToken(&user)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Subscription upgraded successfully",
		"token":   newToken,
		"user":    user,
	})
}

func CancelSubscription(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	now := time.Now()
	_, err := database.DB.Exec(
		"UPDATE users SET subscription_tier = 'free', updated_at = ? WHERE id = ?",
		now, claims.UserID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel subscription"}`, http.StatusInternalServerError)
		return
	}

	var user models.User
	_ = database.DB.QueryRow(
		"SELECT id, email, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE id = ?",
		claims.UserID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)

	newToken, _ := middleware.GenerateToken(&user)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Subscription reverted to free plan",
		"token":   newToken,
		"user":    user,
	})
}

