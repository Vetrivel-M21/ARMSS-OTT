package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"os"
	"testing"

	_ "modernc.org/sqlite"
)

func TestMockGateway(t *testing.T) {
	ctx := context.Background()
	gw := &MockGateway{}

	if gw.Name() != "mock" {
		t.Fatalf("expected name mock, got %s", gw.Name())
	}

	order, err := gw.CreateOrder(ctx, OrderRequest{
		UserID:    "u-123",
		PlanID:    "premium",
		AmountINR: 199,
		Currency:  "INR",
	})
	if err != nil {
		t.Fatalf("unexpected CreateOrder error: %v", err)
	}
	if order.KeyID != "rzp_test_mock_key" {
		t.Errorf("expected rzp_test_mock_key, got %s", order.KeyID)
	}
	if order.AmountINR != 199 {
		t.Errorf("expected 199 amount, got %d", order.AmountINR)
	}

	res, err := gw.VerifyPayment(ctx, VerifyRequest{
		UserID:            "u-123",
		PlanID:            "premium",
		RazorpayPaymentID: "pay_test_123",
	})
	if err != nil {
		t.Fatalf("unexpected VerifyPayment error: %v", err)
	}
	if !res.Success {
		t.Errorf("expected verify success")
	}
	if res.TransactionID != "pay_test_123" {
		t.Errorf("expected pay_test_123, got %s", res.TransactionID)
	}
}

func TestRazorpayGateway_SignatureVerification(t *testing.T) {
	ctx := context.Background()
	secret := "super_secret_test_key"
	gw := &RazorpayGateway{
		KeyID:     "rzp_test_key",
		KeySecret: secret,
	}

	orderID := "order_abc123"
	paymentID := "pay_xyz789"
	payload := orderID + "|" + paymentID

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	validSignature := hex.EncodeToString(h.Sum(nil))

	// 1. Valid Signature Test
	res, err := gw.VerifyPayment(ctx, VerifyRequest{
		UserID:            "u-1",
		PlanID:            "standard",
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: validSignature,
	})
	if err != nil {
		t.Fatalf("expected valid signature to pass, got err: %v", err)
	}
	if !res.Success {
		t.Errorf("expected verification success")
	}

	// 2. Invalid Signature Test
	_, err = gw.VerifyPayment(ctx, VerifyRequest{
		UserID:            "u-1",
		PlanID:            "standard",
		RazorpayOrderID:   orderID,
		RazorpayPaymentID: paymentID,
		RazorpaySignature: "invalid_tampered_signature",
	})
	if err == nil {
		t.Fatalf("expected invalid signature to return error")
	}
}

func TestGetActiveGateway(t *testing.T) {
	_ = os.Unsetenv("RAZORPAY_KEY_ID")
	_ = os.Unsetenv("RAZORPAY_KEY_SECRET")

	gw := GetActiveGateway()
	if gw.Name() != "mock" {
		t.Errorf("expected default gateway to be mock, got %s", gw.Name())
	}

	_ = os.Setenv("RAZORPAY_KEY_ID", "rzp_live_test")
	_ = os.Setenv("RAZORPAY_KEY_SECRET", "secret_test")
	defer func() {
		_ = os.Unsetenv("RAZORPAY_KEY_ID")
		_ = os.Unsetenv("RAZORPAY_KEY_SECRET")
	}()

	gw = GetActiveGateway()
	if gw.Name() != "razorpay" {
		t.Errorf("expected razorpay gateway when keys set, got %s", gw.Name())
	}
}

func TestSavePaymentRecord_SQLite(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed opening sqlite: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	_, err = db.ExecContext(ctx, `
		CREATE TABLE payments (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64) NOT NULL,
			plan_id VARCHAR(32) NOT NULL,
			amount_inr INT NOT NULL,
			currency VARCHAR(10) NOT NULL DEFAULT 'INR',
			gateway VARCHAR(32) NOT NULL DEFAULT 'mock',
			order_id VARCHAR(128) NOT NULL,
			payment_id VARCHAR(128) NOT NULL,
			signature VARCHAR(255) DEFAULT '',
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		);`)
	if err != nil {
		t.Fatalf("creating test schema: %v", err)
	}

	rec := PaymentRecord{
		UserID:    "user_test_99",
		PlanID:    "premium",
		AmountINR: 199,
		Gateway:   "mock",
		OrderID:   "ord_1",
		PaymentID: "pay_1",
		Status:    "completed",
	}

	if err := SavePaymentRecord(ctx, db, rec); err != nil {
		t.Fatalf("failed saving payment record: %v", err)
	}

	var count int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM payments WHERE user_id = 'user_test_99'").Scan(&count)
	if err != nil || count != 1 {
		t.Errorf("expected 1 record in payments table, got %d (err: %v)", count, err)
	}
}

