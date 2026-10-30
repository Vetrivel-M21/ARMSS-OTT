package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"os"
	"testing"
)

func TestCashfreeGateway_Basics(t *testing.T) {
	gw := NewCashfreeGateway("test_app_id", "test_secret_key", "SANDBOX")

	if gw.Name() != "cashfree" {
		t.Fatalf("expected name cashfree, got %s", gw.Name())
	}

	if gw.Environment != "SANDBOX" {
		t.Fatalf("expected SANDBOX environment, got %s", gw.Environment)
	}

	if gw.getBaseURL() != "https://sandbox.cashfree.com/pg" {
		t.Fatalf("expected sandbox url, got %s", gw.getBaseURL())
	}

	prodGw := NewCashfreeGateway("test_app_id", "test_secret_key", "PRODUCTION")
	if prodGw.getBaseURL() != "https://api.cashfree.com/pg" {
		t.Fatalf("expected production url, got %s", prodGw.getBaseURL())
	}
}

func TestCashfreeGateway_MockCreateOrder(t *testing.T) {
	ctx := context.Background()
	gw := NewCashfreeGateway("", "", "SANDBOX") // Dev mock mode

	res, err := gw.CreateOrder(ctx, OrderRequest{
		UserID:    "user_101",
		UserEmail: "test@example.com",
		UserName:  "Test User",
		PlanID:    "premium",
		AmountINR: 199,
		Currency:  "INR",
	})
	if err != nil {
		t.Fatalf("unexpected error creating order: %v", err)
	}

	if res.Gateway != "cashfree" {
		t.Errorf("expected gateway cashfree, got %s", res.Gateway)
	}
	if res.PlanID != "premium" {
		t.Errorf("expected plan_id premium, got %s", res.PlanID)
	}
	if res.PaymentSessionID == "" {
		t.Errorf("expected non-empty payment_session_id")
	}
	if res.OrderID == "" {
		t.Errorf("expected non-empty order_id")
	}
}

func TestCashfreeGateway_WebhookSignatureVerification(t *testing.T) {
	secret := "cf_test_secret_12345"
	timestamp := "1710000000"
	rawBody := []byte(`{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"cf_ord_1"}}}`)

	// Compute valid signature: base64(hmac-sha256(timestamp + rawBody, secret))
	data := append([]byte(timestamp), rawBody...)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	validSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// 1. Valid Signature Test
	if !VerifyCashfreeWebhookSignature(rawBody, validSig, timestamp, secret) {
		t.Errorf("expected valid signature to pass verification")
	}

	// 2. Tampered Payload Test
	tamperedBody := []byte(`{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"tampered"}}}`)
	if VerifyCashfreeWebhookSignature(tamperedBody, validSig, timestamp, secret) {
		t.Errorf("expected tampered body to fail signature verification")
	}

	// 3. Tampered Timestamp Test
	if VerifyCashfreeWebhookSignature(rawBody, validSig, "1710000001", secret) {
		t.Errorf("expected mismatched timestamp to fail signature verification")
	}

	// 4. Invalid Signature String
	if VerifyCashfreeWebhookSignature(rawBody, "invalid_sig", timestamp, secret) {
		t.Errorf("expected invalid signature string to fail")
	}
}

func TestCashfreeGateway_MockVerifyPayment(t *testing.T) {
	ctx := context.Background()
	gw := NewCashfreeGateway("", "", "SANDBOX")

	res, err := gw.VerifyPayment(ctx, VerifyRequest{
		UserID:          "user_101",
		PlanID:          "standard",
		CashfreeOrderID: "cf_ord_mock_123",
	})
	if err != nil {
		t.Fatalf("unexpected verify payment error: %v", err)
	}

	if !res.Success {
		t.Errorf("expected verification success")
	}
	if res.Gateway != "cashfree" {
		t.Errorf("expected gateway cashfree, got %s", res.Gateway)
	}
}

func TestGetActiveGateway_Cashfree(t *testing.T) {
	_ = os.Setenv("PAYMENT_GATEWAY", "cashfree")
	_ = os.Setenv("CASHFREE_APP_ID", "cf_app_test")
	_ = os.Setenv("CASHFREE_SECRET_KEY", "cf_secret_test")
	defer func() {
		_ = os.Unsetenv("PAYMENT_GATEWAY")
		_ = os.Unsetenv("CASHFREE_APP_ID")
		_ = os.Unsetenv("CASHFREE_SECRET_KEY")
	}()

	gw := GetActiveGateway()
	if gw.Name() != "cashfree" {
		t.Errorf("expected active gateway to be cashfree, got %s", gw.Name())
	}
}
