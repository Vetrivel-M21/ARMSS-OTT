package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"armss-ott-backend/database"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

func TestVerifyWebhookSignature(t *testing.T) {
	secret := "secret_key_123"
	payload := []byte(`{"event":"subscription.charged"}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	validSig := hex.EncodeToString(mac.Sum(nil))

	if !VerifyWebhookSignature(payload, validSig, secret) {
		t.Errorf("expected valid signature to be verified")
	}

	if VerifyWebhookSignature(payload, "invalid_signature", secret) {
		t.Errorf("expected invalid signature to fail verification")
	}
}

func TestVerifyPaymentSignature(t *testing.T) {
	secret := "rzp_secret_xyz_456"
	paymentID := "pay_test_123"
	subscriptionID := "sub_test_789"
	dataToSign := paymentID + "|" + subscriptionID

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(dataToSign))
	validSig := hex.EncodeToString(mac.Sum(nil))

	if !VerifyPaymentSignature(dataToSign, validSig, secret) {
		t.Errorf("expected valid checkout signature to pass verification")
	}

	if VerifyPaymentSignature(dataToSign, "invalid_sig", secret) {
		t.Errorf("expected invalid checkout signature to fail verification")
	}

	// Dev mock mode when secret is empty
	if !VerifyPaymentSignature(dataToSign, "any_sig", "") {
		t.Errorf("expected mock dev mode to allow empty secret")
	}
}

func TestCreateSubscriptionCheckout_Unauthorized(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/subscription/checkout", bytes.NewReader([]byte(`{"plan_id":"premium"}`)))
	rr := httptest.NewRecorder()

	CreateSubscriptionCheckout(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 Unauthorized without auth claims, got %d", rr.Code)
	}
}

func TestVerifySubscriptionPayment_Unauthorized(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/subscription/verify", bytes.NewReader([]byte(`{"plan_id":"premium"}`)))
	rr := httptest.NewRecorder()

	VerifySubscriptionPayment(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 Unauthorized without auth claims, got %d", rr.Code)
	}
}

func TestRazorpayWebhook_MySQL(t *testing.T) {
	testDSN := strings.TrimSpace(os.Getenv("PLAN_ACCESS_TEST_MYSQL_DSN"))
	if testDSN == "" {
		t.Skip("skipping MySQL Razorpay webhook tests: PLAN_ACCESS_TEST_MYSQL_DSN is not set")
		return
	}

	if strings.Contains(testDSN, "/armss_ott?") || strings.HasSuffix(testDSN, "/armss_ott") {
		t.Fatal("SAFETY VIOLATION: PLAN_ACCESS_TEST_MYSQL_DSN must point to a dedicated test database")
	}

	db, err := sql.Open("mysql", testDSN)
	if err != nil {
		t.Fatalf("failed connecting to MySQL test DB: %v", err)
	}
	defer db.Close()

	oldDB := database.DB
	database.DB = db
	defer func() {
		database.DB = oldDB
	}()

	// Setup test user in test DB
	testUserID := "rzp_user_" + uuid.NewString()[:8]
	_, err = db.Exec(
		`INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at)
		 VALUES (?, ?, 'hash', 'Razorpay Test User', 'free', FALSE, NOW(), NOW())`,
		testUserID, testUserID+"@example.com",
	)
	if err != nil {
		t.Fatalf("inserting test user: %v", err)
	}

	eventID := "evt_" + uuid.NewString()[:12]
	rzpSubID := "sub_" + uuid.NewString()[:12]
	futureEnd := time.Now().AddDate(0, 1, 0).Unix()

	chargedEvent := map[string]interface{}{
		"entity":     "event",
		"account_id": "acc_test",
		"event":      "subscription.charged",
		"created_at": time.Now().Unix(),
		"payload": map[string]interface{}{
			"subscription": map[string]interface{}{
				"entity": map[string]interface{}{
					"id":          rzpSubID,
					"customer_id": "cust_123",
					"current_end": float64(futureEnd),
					"notes": map[string]interface{}{
						"user_id": testUserID,
						"plan_id": "premium",
					},
				},
			},
		},
	}

	rawBody, _ := json.Marshal(chargedEvent)

	// 1. Process subscription.charged webhook
	req := httptest.NewRequest("POST", "/api/webhooks/razorpay", bytes.NewReader(rawBody))
	req.Header.Set("X-Razorpay-Event-Id", eventID)
	rr := httptest.NewRecorder()

	HandleRazorpayWebhook(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("HandleRazorpayWebhook returned code %d: %s", rr.Code, rr.Body.String())
	}

	// Verify user_subscriptions has active record for premium plan
	var subStatus, planID string
	err = db.QueryRow(
		"SELECT status, plan_id FROM user_subscriptions WHERE user_id = ? AND razorpay_subscription_id = ?",
		testUserID, rzpSubID,
	).Scan(&subStatus, &planID)
	if err != nil {
		t.Fatalf("querying user_subscriptions: %v", err)
	}
	if subStatus != "active" || planID != "premium" {
		t.Errorf("expected active premium subscription, got status=%s, plan=%s", subStatus, planID)
	}

	// Verify users.subscription_tier was synchronized to premium
	var userTier string
	_ = db.QueryRow("SELECT subscription_tier FROM users WHERE id = ?", testUserID).Scan(&userTier)
	if userTier != "premium" {
		t.Errorf("expected users.subscription_tier=premium, got %s", userTier)
	}

	// 2. Test Idempotency: replay the exact same event
	reqDuplicate := httptest.NewRequest("POST", "/api/webhooks/razorpay", bytes.NewReader(rawBody))
	reqDuplicate.Header.Set("X-Razorpay-Event-Id", eventID)
	rrDuplicate := httptest.NewRecorder()

	HandleRazorpayWebhook(rrDuplicate, reqDuplicate)
	if rrDuplicate.Code != http.StatusOK {
		t.Fatalf("replay event returned code %d", rrDuplicate.Code)
	}

	var duplicateRes map[string]string
	_ = json.Unmarshal(rrDuplicate.Body.Bytes(), &duplicateRes)
	if duplicateRes["status"] != "already_processed" {
		t.Errorf("expected already_processed status, got %s", duplicateRes["status"])
	}

	// 3. Process subscription.cancelled
	cancelEventID := "evt_cancel_" + uuid.NewString()[:12]
	cancelledEvent := map[string]interface{}{
		"entity":     "event",
		"account_id": "acc_test",
		"event":      "subscription.cancelled",
		"created_at": time.Now().Unix(),
		"payload": map[string]interface{}{
			"subscription": map[string]interface{}{
				"entity": map[string]interface{}{
					"id": rzpSubID,
				},
			},
		},
	}
	rawCancel, _ := json.Marshal(cancelledEvent)

	reqCancel := httptest.NewRequest("POST", "/api/webhooks/razorpay", bytes.NewReader(rawCancel))
	reqCancel.Header.Set("X-Razorpay-Event-Id", cancelEventID)
	rrCancel := httptest.NewRecorder()

	HandleRazorpayWebhook(rrCancel, reqCancel)
	if rrCancel.Code != http.StatusOK {
		t.Fatalf("HandleRazorpayWebhook cancel returned code %d: %s", rrCancel.Code, rrCancel.Body.String())
	}

	// Verify user_subscriptions has status = 'cancelled'
	var cancelledStatus string
	_ = db.QueryRow("SELECT status FROM user_subscriptions WHERE razorpay_subscription_id = ?", rzpSubID).Scan(&cancelledStatus)
	if cancelledStatus != "cancelled" {
		t.Errorf("expected cancelled subscription status, got %s", cancelledStatus)
	}
}
