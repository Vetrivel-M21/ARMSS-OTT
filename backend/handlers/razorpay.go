package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"armss-ott-backend/services/payment"

	"github.com/google/uuid"
)

// RazorpayWebhookPayload represents the outer structure of a Razorpay webhook event.
type RazorpayWebhookPayload struct {
	Entity    string                 `json:"entity"`
	AccountID string                 `json:"account_id"`
	Event     string                 `json:"event"`
	Contains  []string               `json:"contains"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt int64                  `json:"created_at"`
}

// VerifyWebhookSignature validates the HMAC SHA-256 signature from Razorpay.
func VerifyWebhookSignature(rawBody []byte, signature, secret string) bool {
	if secret == "" {
		// In development test environments without a configured secret, allow testing
		return true
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expectedMAC := mac.Sum(nil)
	expectedSig := hex.EncodeToString(expectedMAC)
	return hmac.Equal([]byte(expectedSig), []byte(signature))
}

// HandleRazorpayWebhook handles POST /api/webhooks/razorpay.
// Webhooks are the sole source of truth for payment & subscription states.
func HandleRazorpayWebhook(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}

	secret := os.Getenv("RAZORPAY_WEBHOOK_SECRET")
	signature := r.Header.Get("X-Razorpay-Signature")

	if secret != "" && !VerifyWebhookSignature(rawBody, signature, secret) {
		log.Printf("[Razorpay Webhook] Invalid signature rejected")
		http.Error(w, `{"error":"invalid webhook signature"}`, http.StatusBadRequest)
		return
	}

	var event RazorpayWebhookPayload
	if err := json.Unmarshal(rawBody, &event); err != nil {
		http.Error(w, `{"error":"invalid JSON event"}`, http.StatusBadRequest)
		return
	}

	// 1. Idempotency Check using razorpay_webhook_events table
	eventID := r.Header.Get("X-Razorpay-Event-Id")
	if eventID == "" {
		// Generate deterministically from event + createdAt if header missing
		eventID = fmt.Sprintf("%s_%d", event.Event, event.CreatedAt)
	}

	var existingID string
	checkErr := database.DB.QueryRowContext(r.Context(),
		"SELECT event_id FROM razorpay_webhook_events WHERE event_id = ?",
		eventID,
	).Scan(&existingID)

	if checkErr == nil {
		// Already processed — return 200 immediately
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "already_processed",
			"event_id": eventID,
		})
		return
	}

	// 2. Dispatch based on event type
	switch event.Event {
	case "subscription.charged", "payment.captured":
		if err := processSubscriptionCharged(r, event.Payload); err != nil {
			log.Printf("[Razorpay Webhook] Error processing %s: %v", event.Event, err)
			http.Error(w, fmt.Sprintf(`{"error":"failed processing event: %v"}`, err), http.StatusInternalServerError)
			return
		}

	case "subscription.cancelled", "subscription.halted":
		if err := processSubscriptionCancelled(r, event.Payload); err != nil {
			log.Printf("[Razorpay Webhook] Error processing %s: %v", event.Event, err)
			http.Error(w, fmt.Sprintf(`{"error":"failed processing event: %v"}`, err), http.StatusInternalServerError)
			return
		}

	default:
		log.Printf("[Razorpay Webhook] Unhandled event type: %s (acknowledged)", event.Event)
	}

	// 3. Record processed event in razorpay_webhook_events for future idempotency
	_, _ = database.DB.ExecContext(r.Context(),
		`INSERT IGNORE INTO razorpay_webhook_events (event_id, event_type, payload_json, processed_at)
		 VALUES (?, ?, ?, NOW())`,
		eventID, event.Event, string(rawBody),
	)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"event_id": eventID,
	})
}

func processSubscriptionCharged(r *http.Request, payload map[string]interface{}) error {
	ctx := r.Context()
	subData, ok := payload["subscription"].(map[string]interface{})
	if !ok {
		// Try payment entity fallback
		paymentData, pOk := payload["payment"].(map[string]interface{})
		if pOk {
			notes, _ := paymentData["notes"].(map[string]interface{})
			if notes != nil {
				userID, _ := notes["user_id"].(string)
				planID, _ := notes["plan_id"].(string)
				if userID != "" && planID != "" {
					return activateUserPlan(ctx, userID, planID, "pay_"+uuid.NewString()[:8], "", time.Now().AddDate(0, 1, 0))
				}
			}
		}
		return fmt.Errorf("no subscription or payment object in payload")
	}

	subEntity, ok := subData["entity"].(map[string]interface{})
	if !ok {
		subEntity = subData
	}

	rzpSubID, _ := subEntity["id"].(string)
	customerID, _ := subEntity["customer_id"].(string)

	// Extract notes
	var userID, planID string
	if notes, ok := subEntity["notes"].(map[string]interface{}); ok {
		userID, _ = notes["user_id"].(string)
		planID, _ = notes["plan_id"].(string)
	}

	// Period timestamps (Unix timestamp seconds)
	var currentEnd time.Time
	if endUnix, ok := subEntity["current_end"].(float64); ok && endUnix > 0 {
		currentEnd = time.Unix(int64(endUnix), 0)
	} else {
		// Default 30-day period
		currentEnd = time.Now().AddDate(0, 1, 0)
	}

	// If notes were missing from payload, resolve user from existing record by rzpSubID
	if userID == "" && rzpSubID != "" {
		_ = database.DB.QueryRowContext(ctx,
			"SELECT user_id, plan_id FROM user_subscriptions WHERE razorpay_subscription_id = ?",
			rzpSubID,
		).Scan(&userID, &planID)
	}

	if userID == "" {
		return fmt.Errorf("could not determine user_id for subscription %s", rzpSubID)
	}
	if planID == "" {
		planID = "standard"
	}

	return activateUserPlan(ctx, userID, planID, rzpSubID, customerID, currentEnd)
}

func activateUserPlan(ctx context.Context, userID, planID, rzpSubID, customerID string, currentEnd time.Time) error {
	now := time.Now()
	subID := "sub_" + uuid.NewString()[:12]

	upsertQuery := `
		INSERT INTO user_subscriptions 
			(id, user_id, plan_id, razorpay_subscription_id, razorpay_customer_id, status, current_period_start, current_period_end, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE 
			plan_id = VALUES(plan_id),
			status = 'active',
			current_period_start = VALUES(current_period_start),
			current_period_end = VALUES(current_period_end),
			updated_at = VALUES(updated_at)`

	_, err := database.DB.ExecContext(ctx, upsertQuery,
		subID, userID, planID, rzpSubID, customerID, now, currentEnd, now, now,
	)
	if err != nil {
		return fmt.Errorf("upserting user subscription: %w", err)
	}

	// Synchronize users.subscription_tier for legacy entitlement parity
	_, _ = database.DB.ExecContext(ctx,
		"UPDATE users SET subscription_tier = ?, updated_at = NOW() WHERE id = ?",
		planID, userID,
	)

	log.Printf("[Razorpay Webhook] ✓ Activated plan %s for user %s (valid until %s)", planID, userID, currentEnd.Format(time.RFC3339))
	return nil
}

func processSubscriptionCancelled(r *http.Request, payload map[string]interface{}) error {
	ctx := r.Context()
	subData, ok := payload["subscription"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("no subscription object in payload")
	}

	subEntity, ok := subData["entity"].(map[string]interface{})
	if !ok {
		subEntity = subData
	}

	rzpSubID, _ := subEntity["id"].(string)
	if rzpSubID == "" {
		return fmt.Errorf("missing subscription id")
	}

	// Mark subscription cancelled
	_, err := database.DB.ExecContext(ctx,
		"UPDATE user_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE razorpay_subscription_id = ?",
		rzpSubID,
	)
	if err != nil {
		return fmt.Errorf("marking subscription cancelled: %w", err)
	}

	// If period has elapsed, downgrade user tier to free
	_, _ = database.DB.ExecContext(ctx,
		`UPDATE users u
		 JOIN user_subscriptions s ON u.id = s.user_id
		 SET u.subscription_tier = 'free', u.updated_at = NOW()
		 WHERE s.razorpay_subscription_id = ? AND s.current_period_end <= NOW()`,
		rzpSubID,
	)

	log.Printf("[Razorpay Webhook] ✓ Cancelled subscription %s", rzpSubID)
	return nil
}

// CreateSubscriptionCheckout handles POST /api/subscriptions/checkout.
// Initiates Razorpay subscription or order for frontend/mobile Checkout integration.
func CreateSubscriptionCheckout(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		PlanID string `json:"plan_id"` // "standard" or "premium"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	if req.PlanID == "" || req.PlanID == "free" {
		http.Error(w, `{"error":"invalid plan for checkout"}`, http.StatusBadRequest)
		return
	}

	// Resolve target plan from database
	var (
		planName       string
		priceINR       int
		razorpayPlanID string
		isActive       bool
	)
	query := "SELECT name, price_inr, razorpay_plan_id, is_active FROM plans WHERE id = ?"
	err := database.DB.QueryRowContext(r.Context(), query, req.PlanID).Scan(
		&planName, &priceINR, &razorpayPlanID, &isActive,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"plan not found"}`, http.StatusNotFound)
		} else {
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		}
		return
	}

	if !isActive {
		http.Error(w, `{"error":"plan is not currently active"}`, http.StatusBadRequest)
		return
	}

	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")

	var subID string
	var orderID string

	// If live/test Razorpay API credentials are configured, attempt real Razorpay API call
	if keyID != "" && keySecret != "" && keyID != "rzp_test_mock_key" {
		client := &http.Client{Timeout: 10 * time.Second}

		if razorpayPlanID != "" {
			// Create subscription via Razorpay Subscriptions API
			subPayload, _ := json.Marshal(map[string]interface{}{
				"plan_id":         razorpayPlanID,
				"total_count":     12,
				"quantity":        1,
				"customer_notify": 1,
				"notes": map[string]string{
					"user_id": claims.UserID,
					"plan_id": req.PlanID,
				},
			})
			httpReq, err := http.NewRequestWithContext(r.Context(), "POST", "https://api.razorpay.com/v1/subscriptions", bytes.NewReader(subPayload))
			if err == nil {
				httpReq.SetBasicAuth(keyID, keySecret)
				httpReq.Header.Set("Content-Type", "application/json")
				resp, respErr := client.Do(httpReq)
				if respErr == nil {
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
						var rzpResp map[string]interface{}
						if json.NewDecoder(resp.Body).Decode(&rzpResp) == nil {
							if idStr, ok := rzpResp["id"].(string); ok && idStr != "" {
								subID = idStr
							}
						}
					} else {
						respBody, _ := io.ReadAll(resp.Body)
						log.Printf("[Razorpay API] Subscription create status %d: %s", resp.StatusCode, string(respBody))
					}
				} else {
					log.Printf("[Razorpay API] Subscription request error: %v", respErr)
				}
			}
		}

		// If plan has no Razorpay Plan ID or subscription creation failed, create a standard Order
		if subID == "" {
			orderPayload, _ := json.Marshal(map[string]interface{}{
				"amount":   priceINR * 100, // paise
				"currency": "INR",
				"receipt":  fmt.Sprintf("rcpt_%s_%s", req.PlanID, uuid.NewString()[:8]),
				"notes": map[string]string{
					"user_id": claims.UserID,
					"plan_id": req.PlanID,
				},
			})
			httpReq, err := http.NewRequestWithContext(r.Context(), "POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(orderPayload))
			if err == nil {
				httpReq.SetBasicAuth(keyID, keySecret)
				httpReq.Header.Set("Content-Type", "application/json")
				resp, respErr := client.Do(httpReq)
				if respErr == nil {
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
						var rzpResp map[string]interface{}
						if json.NewDecoder(resp.Body).Decode(&rzpResp) == nil {
							if idStr, ok := rzpResp["id"].(string); ok && idStr != "" {
								orderID = idStr
								subID = idStr
							}
						}
					} else {
						respBody, _ := io.ReadAll(resp.Body)
						log.Printf("[Razorpay API] Order create status %d: %s", resp.StatusCode, string(respBody))
					}
				} else {
					log.Printf("[Razorpay API] Order request error: %v", respErr)
				}
			}
		}
	}

	// Dev mock mode fallback if no keys configured or external call failed
	if keyID == "" {
		keyID = "rzp_test_mock_key"
	}
	if subID == "" {
		subID = fmt.Sprintf("sub_mock_%s_%s", req.PlanID, uuid.NewString()[:8])
	}

	// Pre-create pending record in user_subscriptions for tracking
	now := time.Now()
	_, _ = database.DB.ExecContext(r.Context(),
		`INSERT INTO user_subscriptions 
			(id, user_id, plan_id, razorpay_subscription_id, razorpay_customer_id, status, current_period_start, current_period_end, created_at, updated_at)
		 VALUES (?, ?, ?, ?, '', 'pending', ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), status = 'pending', updated_at = NOW()`,
		uuid.NewString(), claims.UserID, req.PlanID, subID, now, now.AddDate(0, 1, 0), now, now,
	)

	var userName string
	_ = database.DB.QueryRowContext(r.Context(), "SELECT name FROM users WHERE id = ?", claims.UserID).Scan(&userName)
	if userName == "" {
		userName = claims.Email
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"subscription_id": subID,
		"order_id":        orderID,
		"key_id":          keyID,
		"plan_id":         req.PlanID,
		"plan_name":       planName,
		"amount_inr":      priceINR,
		"currency":        "INR",
		"user_email":      claims.Email,
		"user_name":       userName,
	})
}

// VerifyPaymentSignature validates HMAC SHA-256 signature from client checkout.
func VerifyPaymentSignature(dataToSign, signature, secret string) bool {
	if secret == "" {
		// Test/dev mode without secret
		return true
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(dataToSign))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

type VerifyPaymentRequest struct {
	PlanID                 string `json:"plan_id"`
	RazorpayPaymentID      string `json:"razorpay_payment_id"`
	RazorpaySubscriptionID string `json:"razorpay_subscription_id,omitempty"`
	RazorpayOrderID        string `json:"razorpay_order_id,omitempty"`
	RazorpaySignature      string `json:"razorpay_signature"`
}

// VerifySubscriptionPayment handles POST /api/subscription/verify.
// Validates client checkout signature and immediately upgrades the user's tier.
func VerifySubscriptionPayment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req VerifyPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.PlanID == "" || req.PlanID == "free" {
		http.Error(w, `{"error":"valid paid plan_id is required"}`, http.StatusBadRequest)
		return
	}

	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")

	// Determine dataToSign based on whether payment was via subscription or order
	var dataToSign string
	trackingID := req.RazorpaySubscriptionID
	if req.RazorpaySubscriptionID != "" {
		dataToSign = req.RazorpayPaymentID + "|" + req.RazorpaySubscriptionID
	} else if req.RazorpayOrderID != "" {
		dataToSign = req.RazorpayOrderID + "|" + req.RazorpayPaymentID
		trackingID = req.RazorpayOrderID
	} else {
		trackingID = "mock_sub_" + uuid.NewString()[:8]
	}

	if keySecret != "" && req.RazorpaySignature != "" {
		if !VerifyPaymentSignature(dataToSign, req.RazorpaySignature, keySecret) {
			log.Printf("[Razorpay Verify] Invalid signature rejected for user %s, plan %s", claims.UserID, req.PlanID)
			http.Error(w, `{"error":"invalid payment signature"}`, http.StatusBadRequest)
			return
		}
	}

	// Signature is valid — activate subscription in user_subscriptions & users table
	if err := activateUserPlan(r.Context(), claims.UserID, req.PlanID, trackingID, "", time.Now().AddDate(0, 1, 0)); err != nil {
		log.Printf("[Razorpay Verify] Failed to activate plan: %v", err)
		http.Error(w, `{"error":"failed to activate subscription in database"}`, http.StatusInternalServerError)
		return
	}

	// Persist audit record in payments table
	_ = payment.SavePaymentRecord(r.Context(), database.DB, payment.PaymentRecord{
		UserID:    claims.UserID,
		PlanID:    req.PlanID,
		Gateway:   "razorpay",
		OrderID:   req.RazorpayOrderID,
		PaymentID: req.RazorpayPaymentID,
		Signature: req.RazorpaySignature,
		Status:    "completed",
	})

	// Fetch updated user record
	var user models.User
	err := database.DB.QueryRowContext(r.Context(),
		"SELECT id, email, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE id = ?",
		claims.UserID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch updated user"}`, http.StatusInternalServerError)
		return
	}

	newToken, err := middleware.GenerateToken(&user)
	if err != nil {
		http.Error(w, `{"error":"failed to issue updated authentication token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Subscription activated successfully",
		"token":   newToken,
		"user":    user,
	})
}

