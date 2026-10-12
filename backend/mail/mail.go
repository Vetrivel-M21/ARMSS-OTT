package mail

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// SendPasswordResetOTP sends a branded HTML email presenting a 6-digit OTP code,
// matching the ARMSS Gateway & MIS Desktop strategy.
func SendPasswordResetOTP(toEmail, userName, otpCode string) error {
	subject := "ARMSS-OTT — Password Reset Verification Code"
	heading := "Reset Your ARMSS-OTT Password"
	message := fmt.Sprintf("Hello %s,<br><br>We received a request to reset your password. Enter the one-time verification code below to proceed.", html.EscapeString(userName))

	// Always log OTP to server console for zero-downtime developer convenience
	log.Printf("[ARMSS-OTT OTP] >>> Verification code for %s (%s): %s (Valid for 15 mins) <<<", toEmail, userName, otpCode)

	body := otpEmailHTML(heading, message, otpCode)
	return send(toEmail, subject, "text/html", body)
}

// SendRegistrationOTP sends a branded HTML email presenting a 6-digit registration verification code.
func SendRegistrationOTP(toEmail, userName, otpCode string) error {
	subject := "ARMSS-OTT — Verify Your Email Address"
	heading := "Welcome to ARMSS-OTT"
	message := fmt.Sprintf("Hello %s,<br><br>Thank you for creating an account with ARMSS-OTT. Enter the one-time verification code below to activate your account and start streaming.", html.EscapeString(userName))

	// Always log OTP to server console for zero-downtime developer convenience
	log.Printf("[ARMSS-OTT OTP] >>> Registration verification code for %s (%s): %s (Valid for 15 mins) <<<", toEmail, userName, otpCode)

	body := otpEmailHTML(heading, message, otpCode)
	return send(toEmail, subject, "text/html", body)
}

func send(to, subject, contentType, body string) error {
	// 1. Try Bird Email REST API first if configured via environment
	birdKey := os.Getenv("BIRD_API_KEY")
	if birdKey != "" {
		err := sendViaBird(birdKey, to, subject, contentType, body)
		if err == nil {
			log.Printf("[ARMSS-OTT Mailer] ✓ Email dispatched successfully via Bird API to %s", to)
			return nil
		}
		log.Printf("[ARMSS-OTT Mailer] Warning: Bird API failed (%v), falling back to SMTP...", err)
	}

	// 2. Fall back to SMTP if configured via environment variables
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := getEnv("SMTP_PORT", "465")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM_ADDRESS")
	if smtpFrom == "" {
		smtpFrom = smtpUser
	}

	if smtpHost != "" && smtpUser != "" && smtpPass != "" {
		err := sendViaSMTP(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, to, subject, contentType, body)
		if err == nil {
			log.Printf("[ARMSS-OTT Mailer] ✓ Email dispatched successfully via SMTP to %s", to)
			return nil
		}
		log.Printf("[ARMSS-OTT Mailer] SMTP delivery failed (%v). Note: Console OTP code was generated above for testing.", err)
		return nil
	}

	log.Printf("[ARMSS-OTT Mailer] Outbound mail not configured (BIRD_API_KEY or SMTP_* unset). Console OTP code generated above.")
	return nil // Non-blocking so local dev without outbound SMTP network connectivity still works
}

type birdAddress struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type birdMessagePayload struct {
	From     birdAddress   `json:"from"`
	To       []birdAddress `json:"to"`
	Subject  string        `json:"subject"`
	HTML     string        `json:"html,omitempty"`
	Text     string        `json:"text,omitempty"`
	Category string        `json:"category"`
}

func sendViaBird(apiKey, to, subject, contentType, body string) error {
	endpoint := getEnv("BIRD_API_URL", "https://eu1.platform.bird.com/v1/email/messages")
	fromEmail := getEnv("BIRD_FROM_EMAIL", "noreply@arminfo.in")
	fromName := getEnv("BIRD_FROM_NAME", "ARMSS OTT")

	payload := birdMessagePayload{
		From: birdAddress{
			Email: fromEmail,
			Name:  fromName,
		},
		To: []birdAddress{
			{Email: to},
		},
		Subject:  subject,
		Category: "transactional",
	}

	if contentType == "text/html" {
		payload.HTML = body
		payload.Text = stripHTML(body)
	} else {
		payload.Text = body
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}

	authHeader := apiKey
	if !strings.HasPrefix(authHeader, "Bearer ") && !strings.HasPrefix(authHeader, "AccessKey ") {
		authHeader = "Bearer " + authHeader
	}

	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func sendViaSMTP(host, port, user, pass, from, to, subject, contentType, body string) error {
	addr := fmt.Sprintf("%s:%s", host, port)

	dialer := &net.Dialer{Timeout: 8 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName: host,
	})
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", user, pass, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}

	now := time.Now()
	msg := fmt.Sprintf("From: ARMSS OTT <%s>\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMIME-Version: 1.0\r\nContent-Type: %s; charset=UTF-8\r\n\r\n%s",
		from, to, subject, now.Format(time.RFC1123Z), contentType, body)

	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func otpEmailHTML(heading, message, otp string) string {
	heading = html.EscapeString(heading)
	otp = html.EscapeString(otp)

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#070708;font-family:'Segoe UI',Arial,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#070708;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#121216;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <tr>
            <td style="background-color:#E50914;background-image:linear-gradient(135deg,#E50914,#B81D24);padding:24px 32px;">
              <span style="color:#FFFFFF;font-size:22px;font-weight:900;letter-spacing:1px;font-style:italic;">ARMSS <span style="background:#000;color:#fff;padding:2px 6px;border-radius:4px;font-size:12px;font-style:normal;vertical-align:middle;">OTT</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px;">
              <h2 style="margin:0 0 12px;color:#FFFFFF;font-size:20px;font-weight:700;">%s</h2>
              <p style="margin:0 0 24px;color:#A1A1AA;font-size:14px;line-height:1.6;">%s</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#1E1E24;border:1px solid rgba(229,9,20,0.3);border-radius:12px;">
                <tr>
                  <td align="center" style="padding:24px;">
                    <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#E50914;font-family:'Consolas','Courier New',monospace;">%s</span>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#71717A;font-size:12px;line-height:1.5;">This verification code expires in <strong>15 minutes</strong>. If you did not request this code, no action is needed and your account remains secure.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px;background-color:#0D0D11;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
              <span style="color:#71717A;font-size:11px;">© 2026 ARMSS Group of Companies · Enterprise Streaming Platform</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, heading, message, otp)
}

func stripHTML(input string) string {
	var out strings.Builder
	inTag := false
	for _, r := range input {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			out.WriteRune(r)
		}
	}
	return strings.TrimSpace(out.String())
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
