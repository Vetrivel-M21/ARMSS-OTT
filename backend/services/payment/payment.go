package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

// OrderRequest contains the parameters required to initialize a checkout order.
type OrderRequest struct {
	UserID    string `json:"user_id"`
	UserEmail string `json:"user_email"`
	UserName  string `json:"user_name"`
	PlanID    string `json:"plan_id"`
	AmountINR int    `json:"amount_inr"`
	Currency  string `json:"currency"`
}

// OrderResponse returns checkout initialization details to the web client.
type OrderResponse struct {
	OrderID        string `json:"order_id"`
	SubscriptionID string `json:"subscription_id,omitempty"`
	KeyID          string `json:"key_id"`
	PlanID         string `json:"plan_id"`
	PlanName       string `json:"plan_name"`
	AmountINR      int    `json:"amount_inr"`
	Currency       string `json:"currency"`
	UserEmail      string `json:"user_email"`
	UserName       string `json:"user_name"`
	Gateway        string `json:"gateway"`
}

// VerifyRequest contains transaction credentials to verify after client checkout.
type VerifyRequest struct {
	UserID                 string `json:"user_id"`
	PlanID                 string `json:"plan_id"`
	RazorpayPaymentID      string `json:"razorpay_payment_id"`
	RazorpayOrderID        string `json:"razorpay_order_id,omitempty"`
	RazorpaySubscriptionID string `json:"razorpay_subscription_id,omitempty"`
	RazorpaySignature      string `json:"razorpay_signature"`
}

// VerifyResult contains the verification decision.
type VerifyResult struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id"`
	PlanID        string `json:"plan_id"`
	Message       string `json:"message"`
	Gateway       string `json:"gateway"`
}

// PaymentGateway defines the pluggable contract for payment gateways (Razorpay, Cashfree, PhonePe, Mock, etc.).
type PaymentGateway interface {
	Name() string
	CreateOrder(ctx context.Context, req OrderRequest) (*OrderResponse, error)
	VerifyPayment(ctx context.Context, req VerifyRequest) (*VerifyResult, error)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Provider (Default for Dev / Staging / Testing)
// ─────────────────────────────────────────────────────────────────────────────

type MockGateway struct{}

func (m *MockGateway) Name() string {
	return "mock"
}

func (m *MockGateway) CreateOrder(ctx context.Context, req OrderRequest) (*OrderResponse, error) {
	planName := "Standard HD"
	if req.PlanID == "premium" {
		planName = "Premium VIP 4K"
	}

	orderID := fmt.Sprintf("mock_ord_%s", uuid.NewString()[:12])
	return &OrderResponse{
		OrderID:   orderID,
		KeyID:     "rzp_test_mock_key",
		PlanID:    req.PlanID,
		PlanName:  planName,
		AmountINR: req.AmountINR,
		Currency:  "INR",
		UserEmail: req.UserEmail,
		UserName:  req.UserName,
		Gateway:   "mock",
	}, nil
}

func (m *MockGateway) VerifyPayment(ctx context.Context, req VerifyRequest) (*VerifyResult, error) {
	if req.PlanID == "" {
		return nil, fmt.Errorf("plan_id is required")
	}

	txnID := req.RazorpayPaymentID
	if txnID == "" {
		txnID = fmt.Sprintf("mock_pay_%s", uuid.NewString()[:12])
	}

	return &VerifyResult{
		Success:       true,
		TransactionID: txnID,
		PlanID:        req.PlanID,
		Message:       "Mock payment verified successfully (Dev Mode)",
		Gateway:       "mock",
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Provider
// ─────────────────────────────────────────────────────────────────────────────

type RazorpayGateway struct {
	KeyID     string
	KeySecret string
}

func (r *RazorpayGateway) Name() string {
	return "razorpay"
}

func (r *RazorpayGateway) CreateOrder(ctx context.Context, req OrderRequest) (*OrderResponse, error) {
	planName := "Standard HD"
	if req.PlanID == "premium" {
		planName = "Premium VIP 4K"
	}

	orderID := fmt.Sprintf("order_%s", uuid.NewString()[:14])
	return &OrderResponse{
		OrderID:   orderID,
		KeyID:     r.KeyID,
		PlanID:    req.PlanID,
		PlanName:  planName,
		AmountINR: req.AmountINR,
		Currency:  "INR",
		UserEmail: req.UserEmail,
		UserName:  req.UserName,
		Gateway:   "razorpay",
	}, nil
}

func (r *RazorpayGateway) VerifyPayment(ctx context.Context, req VerifyRequest) (*VerifyResult, error) {
	if req.RazorpaySignature == "" || req.RazorpayPaymentID == "" {
		return nil, fmt.Errorf("missing payment credentials or signature")
	}

	// 1. Signature payload: order_id|payment_id OR payment_id|subscription_id
	var payload string
	if req.RazorpayOrderID != "" {
		payload = req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	} else if req.RazorpaySubscriptionID != "" {
		payload = req.RazorpayPaymentID + "|" + req.RazorpaySubscriptionID
	} else {
		payload = req.RazorpayPaymentID
	}

	// 2. Validate HMAC-SHA256 signature
	h := hmac.New(sha256.New, []byte(r.KeySecret))
	h.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(req.RazorpaySignature)) {
		return &VerifyResult{
			Success: false,
			Message: "invalid payment signature",
			Gateway: "razorpay",
		}, fmt.Errorf("payment signature verification failed")
	}

	return &VerifyResult{
		Success:       true,
		TransactionID: req.RazorpayPaymentID,
		PlanID:        req.PlanID,
		Message:       "Razorpay payment verified successfully",
		Gateway:       "razorpay",
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway Resolver & Transaction Recorder
// ─────────────────────────────────────────────────────────────────────────────

// GetActiveGateway returns the configured PaymentGateway implementation.
func GetActiveGateway() PaymentGateway {
	gatewayEnv := strings.ToLower(strings.TrimSpace(os.Getenv("PAYMENT_GATEWAY")))
	rzpKey := strings.TrimSpace(os.Getenv("RAZORPAY_KEY_ID"))
	rzpSecret := strings.TrimSpace(os.Getenv("RAZORPAY_KEY_SECRET"))

	if (gatewayEnv == "razorpay" || gatewayEnv == "") && rzpKey != "" && rzpSecret != "" {
		return &RazorpayGateway{
			KeyID:     rzpKey,
			KeySecret: rzpSecret,
		}
	}

	return &MockGateway{}
}

// PaymentRecord defines an audit log entry stored in the database.
type PaymentRecord struct {
	ID        string
	UserID    string
	PlanID    string
	AmountINR int
	Currency  string
	Gateway   string
	OrderID   string
	PaymentID string
	Signature string
	Status    string
}

// SavePaymentRecord logs a payment attempt or completion in the database.
func SavePaymentRecord(ctx context.Context, db *sql.DB, rec PaymentRecord) error {
	if rec.ID == "" {
		rec.ID = uuid.NewString()
	}
	if rec.Currency == "" {
		rec.Currency = "INR"
	}
	if rec.Status == "" {
		rec.Status = "completed"
	}
	now := time.Now()

	query := `
		INSERT INTO payments (id, user_id, plan_id, amount_inr, currency, gateway, order_id, payment_id, signature, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := db.ExecContext(ctx, query,
		rec.ID, rec.UserID, rec.PlanID, rec.AmountINR, rec.Currency, rec.Gateway,
		rec.OrderID, rec.PaymentID, rec.Signature, rec.Status, now, now,
	)
	return err
}

