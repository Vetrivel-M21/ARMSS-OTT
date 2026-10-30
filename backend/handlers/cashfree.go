package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/services/payment"
)

// CashfreeWebhookPayload represents the structure sent by Cashfree Webhooks.
type CashfreeWebhookPayload struct {
	Type      string                 `json:"type"`       // e.g. "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK"
	EventTime string                 `json:"event_time"` // ISO 8601 string
	Data      map[string]interface{} `json:"data"`
}

// HandleCashfreeWebhook handles POST /api/webhooks/cashfree.
func HandleCashfreeWebhook(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}

	secretKey := os.Getenv("CASHFREE_SECRET_KEY")
	signature := r.Header.Get("x-webhook-signature")
	timestamp := r.Header.Get("x-webhook-timestamp")

	if secretKey != "" {
		if !payment.VerifyCashfreeWebhookSignature(rawBody, signature, timestamp, secretKey) {
			log.Printf("[Cashfree Webhook] Invalid signature rejected")
			http.Error(w, `{"error":"invalid webhook signature"}`, http.StatusBadRequest)
			return
		}
	}

	var payload CashfreeWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		http.Error(w, `{"error":"invalid JSON event"}`, http.StatusBadRequest)
		return
	}

	// 1. Idempotency Check using cashfree_webhook_events table
	eventID := r.Header.Get("x-webhook-id")
	if eventID == "" {
		eventID = fmt.Sprintf("%s_%s_%s", payload.Type, timestamp, signature[:min(16, len(signature))])
	}

	var existingID string
	checkErr := database.DB.QueryRowContext(r.Context(),
		"SELECT event_id FROM cashfree_webhook_events WHERE event_id = ?",
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

	// 2. Dispatch event
	switch strings.ToUpper(payload.Type) {
	case "PAYMENT_SUCCESS_WEBHOOK", "ORDER_PAID_SUCCESS":
		if err := processCashfreePaymentSuccess(r, payload.Data); err != nil {
			log.Printf("[Cashfree Webhook] Error processing payment success: %v", err)
			http.Error(w, fmt.Sprintf(`{"error":"failed processing event: %v"}`, err), http.StatusInternalServerError)
			return
		}
	default:
		log.Printf("[Cashfree Webhook] Unhandled event type: %s (acknowledged)", payload.Type)
	}

	// 3. Record processed event for idempotency
	_, _ = database.DB.ExecContext(r.Context(),
		`INSERT IGNORE INTO cashfree_webhook_events (event_id, event_type, payload_json, processed_at)
		 VALUES (?, ?, ?, NOW())`,
		eventID, payload.Type, string(rawBody),
	)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"event_id": eventID,
	})
}

func processCashfreePaymentSuccess(r *http.Request, data map[string]interface{}) error {
	ctx := r.Context()
	orderData, ok := data["order"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("no order object in cashfree webhook payload")
	}

	orderID, _ := orderData["order_id"].(string)
	if orderID == "" {
		return fmt.Errorf("missing order_id in order payload")
	}

	// Resolve user_id and plan_id from pending subscription or customer details
	var userID, planID string
	customerData, _ := data["customer_details"].(map[string]interface{})
	if customerData != nil {
		userID, _ = customerData["customer_id"].(string)
	}

	// Query pending user_subscriptions by orderID
	if userID == "" || planID == "" {
		_ = database.DB.QueryRowContext(ctx,
			"SELECT user_id, plan_id FROM user_subscriptions WHERE razorpay_subscription_id = ? OR id = ?",
			orderID, orderID,
		).Scan(&userID, &planID)
	}

	if userID == "" {
		return fmt.Errorf("could not determine user_id for cashfree order %s", orderID)
	}
	if planID == "" {
		planID = "standard"
	}

	paymentData, _ := data["payment"].(map[string]interface{})
	cfPaymentID := orderID
	if paymentData != nil {
		if pID, ok := paymentData["cf_payment_id"].(string); ok && pID != "" {
			cfPaymentID = pID
		}
	}

	if err := activateUserPlan(ctx, userID, planID, orderID, "", time.Now().AddDate(0, 1, 0)); err != nil {
		return fmt.Errorf("activating plan for user %s: %w", userID, err)
	}

	// Audit record in payments table
	_ = payment.SavePaymentRecord(ctx, database.DB, payment.PaymentRecord{
		UserID:    userID,
		PlanID:    planID,
		Gateway:   "cashfree",
		OrderID:   orderID,
		PaymentID: cfPaymentID,
		Status:    "completed",
	})

	log.Printf("[Cashfree Webhook] ✓ Activated plan %s for user %s (order: %s)", planID, userID, orderID)
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
