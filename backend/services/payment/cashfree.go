package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

// CashfreeGateway implements PaymentGateway for Cashfree PG (v2023-08-01 API).
type CashfreeGateway struct {
	AppID       string
	SecretKey   string
	Environment string // "SANDBOX" or "PRODUCTION"
	APIVersion  string // Default: "2023-08-01"
	HTTPClient  *http.Client
}

// NewCashfreeGateway creates a configured Cashfree payment gateway client.
func NewCashfreeGateway(appID, secretKey, env string) *CashfreeGateway {
	if env == "" {
		env = "SANDBOX"
	}
	apiVersion := os.Getenv("CASHFREE_API_VERSION")
	if apiVersion == "" {
		apiVersion = "2023-08-01"
	}
	return &CashfreeGateway{
		AppID:       appID,
		SecretKey:   secretKey,
		Environment: strings.ToUpper(strings.TrimSpace(env)),
		APIVersion:  apiVersion,
		HTTPClient:  &http.Client{Timeout: 12 * time.Second},
	}
}

func (c *CashfreeGateway) Name() string {
	return "cashfree"
}

func (c *CashfreeGateway) getBaseURL() string {
	if strings.ToUpper(c.Environment) == "PRODUCTION" {
		return "https://api.cashfree.com/pg"
	}
	return "https://sandbox.cashfree.com/pg"
}

// CashfreeCustomerDetails represents customer info sent to Cashfree.
type CashfreeCustomerDetails struct {
	CustomerID    string `json:"customer_id"`
	CustomerEmail string `json:"customer_email"`
	CustomerPhone string `json:"customer_phone"`
	CustomerName  string `json:"customer_name,omitempty"`
}

// CashfreeOrderRequestPayload represents the payload sent to POST /pg/orders.
type CashfreeOrderRequestPayload struct {
	OrderID         string                  `json:"order_id"`
	OrderAmount     float64                 `json:"order_amount"`
	OrderCurrency   string                  `json:"order_currency"`
	CustomerDetails CashfreeCustomerDetails `json:"customer_details"`
	OrderMeta       map[string]string       `json:"order_meta,omitempty"`
	OrderNote       string                  `json:"order_note,omitempty"`
}

// CashfreeOrderResponsePayload represents the response from POST /pg/orders and GET /pg/orders/{order_id}.
type CashfreeOrderResponsePayload struct {
	OrderID          string  `json:"order_id"`
	CFOrderID        string  `json:"cf_order_id"`
	OrderAmount      float64 `json:"order_amount"`
	OrderCurrency    string  `json:"order_currency"`
	OrderStatus      string  `json:"order_status"` // "ACTIVE", "PAID", "EXPIRED", "CANCELLED"
	PaymentSessionID string  `json:"payment_session_id"`
	Message          string  `json:"message,omitempty"`
}

// CreateOrder creates a Cashfree payment order and returns a checkout payment_session_id.
func (c *CashfreeGateway) CreateOrder(ctx context.Context, req OrderRequest) (*OrderResponse, error) {
	planName := "Standard HD"
	if req.PlanID == "premium" {
		planName = "Premium VIP 4K"
	}

	orderID := fmt.Sprintf("armss_cf_%s", uuid.NewString()[:12])
	phone := "9999999999" // Fallback valid dummy mobile for Cashfree customer details if none provided

	// If running without credentials (e.g. dev mock), return simulated Cashfree session
	if c.AppID == "" || c.SecretKey == "" || c.AppID == "mock_cf_app" {
		return &OrderResponse{
			OrderID:          orderID,
			PaymentSessionID: fmt.Sprintf("session_mock_%s", uuid.NewString()[:16]),
			PlanID:           req.PlanID,
			PlanName:         planName,
			AmountINR:        req.AmountINR,
			Currency:         "INR",
			UserEmail:        req.UserEmail,
			UserName:         req.UserName,
			Gateway:          "cashfree",
			Environment:      c.Environment,
		}, nil
	}

	body := CashfreeOrderRequestPayload{
		OrderID:       orderID,
		OrderAmount:   float64(req.AmountINR),
		OrderCurrency: "INR",
		CustomerDetails: CashfreeCustomerDetails{
			CustomerID:    req.UserID,
			CustomerEmail: req.UserEmail,
			CustomerPhone: phone,
			CustomerName:  req.UserName,
		},
		OrderNote: fmt.Sprintf("ARMSS-OTT %s Subscription", planName),
	}

	rawJSON, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshaling cashfree order payload: %w", err)
	}

	endpoint := fmt.Sprintf("%s/orders", c.getBaseURL())
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(rawJSON))
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-client-id", c.AppID)
	httpReq.Header.Set("x-client-secret", c.SecretKey)
	httpReq.Header.Set("x-api-version", c.APIVersion)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling cashfree create order API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading cashfree response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("cashfree order creation failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var cfResp CashfreeOrderResponsePayload
	if err := json.Unmarshal(respBytes, &cfResp); err != nil {
		return nil, fmt.Errorf("unmarshaling cashfree response: %w", err)
	}

	return &OrderResponse{
		OrderID:          cfResp.OrderID,
		PaymentSessionID: cfResp.PaymentSessionID,
		PlanID:           req.PlanID,
		PlanName:         planName,
		AmountINR:        req.AmountINR,
		Currency:         "INR",
		UserEmail:        req.UserEmail,
		UserName:         req.UserName,
		Gateway:          "cashfree",
		Environment:      c.Environment,
	}, nil
}

// VerifyPayment verifies the status of a Cashfree order by querying Cashfree API.
func (c *CashfreeGateway) VerifyPayment(ctx context.Context, req VerifyRequest) (*VerifyResult, error) {
	orderID := req.CashfreeOrderID
	if orderID == "" {
		orderID = req.RazorpayOrderID
	}
	if orderID == "" {
		return nil, fmt.Errorf("missing cashfree order_id for verification")
	}

	// Dev mock mode
	if c.AppID == "" || c.SecretKey == "" || c.AppID == "mock_cf_app" {
		return &VerifyResult{
			Success:       true,
			TransactionID: fmt.Sprintf("cf_txn_%s", uuid.NewString()[:12]),
			PlanID:        req.PlanID,
			Message:       "Mock Cashfree payment verified successfully (Dev Mode)",
			Gateway:       "cashfree",
		}, nil
	}

	endpoint := fmt.Sprintf("%s/orders/%s", c.getBaseURL(), orderID)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("creating verification request: %w", err)
	}

	httpReq.Header.Set("x-client-id", c.AppID)
	httpReq.Header.Set("x-client-secret", c.SecretKey)
	httpReq.Header.Set("x-api-version", c.APIVersion)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling cashfree order status API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading cashfree order status response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cashfree order status lookup failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var cfResp CashfreeOrderResponsePayload
	if err := json.Unmarshal(respBytes, &cfResp); err != nil {
		return nil, fmt.Errorf("decoding cashfree order status: %w", err)
	}

	if strings.ToUpper(cfResp.OrderStatus) != "PAID" {
		return &VerifyResult{
			Success:       false,
			TransactionID: cfResp.CFOrderID,
			PlanID:        req.PlanID,
			Message:       fmt.Sprintf("Cashfree order status is %s, expected PAID", cfResp.OrderStatus),
			Gateway:       "cashfree",
		}, fmt.Errorf("payment not completed: order status %s", cfResp.OrderStatus)
	}

	txnID := cfResp.CFOrderID
	if txnID == "" {
		txnID = orderID
	}

	return &VerifyResult{
		Success:       true,
		TransactionID: txnID,
		PlanID:        req.PlanID,
		Message:       "Cashfree payment verified successfully",
		Gateway:       "cashfree",
	}, nil
}

// VerifyCashfreeWebhookSignature validates HMAC-SHA256 signature from Cashfree webhooks.
// Cashfree computes: Base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
func VerifyCashfreeWebhookSignature(rawBody []byte, signature, timestamp, secretKey string) bool {
	if secretKey == "" {
		return true // Dev mode without configured secret
	}
	if signature == "" || timestamp == "" {
		return false
	}

	data := append([]byte(timestamp), rawBody...)
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write(data)
	expectedSignature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expectedSignature), []byte(signature))
}
