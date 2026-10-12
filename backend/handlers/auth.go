package handlers

import (
	cryptoRand "crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/mail"
	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Identifier string `json:"identifier"` // Email or Username
	Email      string `json:"email"`      // Backward compatibility
	Password   string `json:"password"`
}

type AuthResponse struct {
	Token    string           `json:"token"`
	User     models.User      `json:"user"`
	Profiles []models.Profile `json:"profiles"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || len(req.Password) < 6 {
		http.Error(w, `{"error":"valid email and password of at least 6 characters are required"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = strings.Split(req.Email, "@")[0]
	}

	// Check if already exists by email OR username
	var existing string
	err := database.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?", req.Email, strings.ToLower(req.Name)).Scan(&existing)
	if err == nil {
		http.Error(w, `{"error":"an account with this email address or username already exists"}`, http.StatusConflict)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed hashing password"}`, http.StatusInternalServerError)
		return
	}

	userID := uuid.New().String()
	now := time.Now()

	user := models.User{
		ID:               userID,
		Email:            req.Email,
		Name:             req.Name,
		SubscriptionTier: models.TierFree,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	_, err = database.DB.Exec(
		"INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		user.ID, user.Email, string(hashedPassword), user.Name, string(user.SubscriptionTier), false, now, now,
	)
	if err != nil {
		http.Error(w, `{"error":"failed creating user"}`, http.StatusInternalServerError)
		return
	}

	// Create default adult profile and kids profile
	profileAdult := models.Profile{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        user.Name,
		AvatarColor: "marble",
		IsKids:      false,
		CreatedAt:   now,
	}
	profileKids := models.Profile{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        "Kids",
		AvatarColor: "moss",
		IsKids:      true,
		Pin:         "1234",
		CreatedAt:   now,
	}

	_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileAdult.ID, userID, profileAdult.Name, profileAdult.AvatarColor, profileAdult.IsKids, profileAdult.Pin, now)
	_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileKids.ID, userID, profileKids.Name, profileKids.AvatarColor, profileKids.IsKids, profileKids.Pin, now)

	token, _ := middleware.GenerateToken(&user)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(AuthResponse{
		Token:    token,
		User:     user,
		Profiles: []models.Profile{profileAdult, profileKids},
	})
}

type RegisterSendOTPRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type RegisterVerifyOTPRequest struct {
	Email    string `json:"email"`
	Otp      string `json:"otp"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// RegisterSendOTP validates registration data and dispatches a 6-digit verification code via Bird API / SMTP
func RegisterSendOTP(w http.ResponseWriter, r *http.Request) {
	var req RegisterSendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	cleanEmail := strings.TrimSpace(strings.ToLower(req.Email))
	cleanName := strings.TrimSpace(req.Name)
	cleanPassword := strings.TrimSpace(req.Password)

	if cleanEmail == "" || !strings.Contains(cleanEmail, "@") || !strings.Contains(cleanEmail, ".") {
		http.Error(w, `{"error":"a valid email address is required"}`, http.StatusBadRequest)
		return
	}
	if len(cleanPassword) < 6 {
		http.Error(w, `{"error":"password must be at least 6 characters"}`, http.StatusBadRequest)
		return
	}
	if cleanName == "" {
		cleanName = strings.Split(cleanEmail, "@")[0]
	}

	// Check if already registered by email OR name
	var existing string
	err := database.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?", cleanEmail, strings.ToLower(cleanName)).Scan(&existing)
	if err == nil {
		http.Error(w, `{"error":"an account with this email address or name already exists"}`, http.StatusConflict)
		return
	}

	// Generate cryptographically secure 6-digit OTP
	otpNum, err := cryptoRandInt(100000, 999999)
	if err != nil {
		http.Error(w, `{"error":"failed generating verification code"}`, http.StatusInternalServerError)
		return
	}
	otpCode := fmt.Sprintf("%06d", otpNum)
	expiresAt := time.Now().Add(15 * time.Minute)

	// Invalidate previous unverified registration OTPs for this email
	_, _ = database.DB.Exec("UPDATE user_otps SET verified = 1 WHERE LOWER(email) = ? AND purpose = 'registration'", cleanEmail)

	// Insert new OTP record
	otpID := uuid.New().String()
	_, err = database.DB.Exec(
		"INSERT INTO user_otps (id, user_id, email, otp_code, purpose, expires_at, verified, created_at) VALUES (?, 'pending', ?, ?, 'registration', ?, 0, ?)",
		otpID, cleanEmail, otpCode, expiresAt, time.Now(),
	)
	if err != nil {
		http.Error(w, `{"error":"failed creating OTP record"}`, http.StatusInternalServerError)
		return
	}

	// Dispatch email via Bird API / SMTP
	_ = mail.SendRegistrationOTP(cleanEmail, cleanName, otpCode)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "A 6-digit verification code has been dispatched to " + cleanEmail,
	})
}

// RegisterVerifyOTP verifies the registration code, commits the user to database, and issues JWT token
func RegisterVerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req RegisterVerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	cleanEmail := strings.TrimSpace(strings.ToLower(req.Email))
	cleanOtp := strings.TrimSpace(req.Otp)
	cleanName := strings.TrimSpace(req.Name)
	cleanPassword := strings.TrimSpace(req.Password)

	if cleanEmail == "" || cleanOtp == "" || len(cleanPassword) < 6 {
		http.Error(w, `{"error":"email, 6-digit code, and valid password are required"}`, http.StatusBadRequest)
		return
	}
	if cleanName == "" {
		cleanName = strings.Split(cleanEmail, "@")[0]
	}

	// Verify matching active registration OTP
	var otpID string
	err := database.DB.QueryRow(
		"SELECT id FROM user_otps WHERE LOWER(email) = ? AND purpose = 'registration' AND otp_code = ? AND verified = 0 AND expires_at > ?",
		cleanEmail, cleanOtp, time.Now(),
	).Scan(&otpID)
	if err != nil {
		http.Error(w, `{"error":"invalid or expired verification code"}`, http.StatusBadRequest)
		return
	}

	// Mark OTP as verified
	_, _ = database.DB.Exec("UPDATE user_otps SET verified = 1 WHERE id = ?", otpID)

	// Concurrency check: make sure email wasn't taken in the interim
	var existing string
	err = database.DB.QueryRow("SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?", cleanEmail, strings.ToLower(cleanName)).Scan(&existing)
	if err == nil {
		http.Error(w, `{"error":"an account with this email address or name already exists"}`, http.StatusConflict)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(cleanPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed hashing password"}`, http.StatusInternalServerError)
		return
	}

	userID := uuid.New().String()
	now := time.Now()

	user := models.User{
		ID:               userID,
		Email:            cleanEmail,
		Name:             cleanName,
		SubscriptionTier: models.TierFree,
		CreatedAt:        now,
		UpdatedAt:        now,
		LastLoginAt:      &now,
		LastActiveAt:     &now,
	}

	_, err = database.DB.Exec(
		"INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, last_login_at, last_active_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		user.ID, user.Email, string(hashedPassword), user.Name, string(user.SubscriptionTier), false, now, now, now, now,
	)
	if err != nil {
		http.Error(w, `{"error":"failed creating user record"}`, http.StatusInternalServerError)
		return
	}

	// Create default adult profile and kids profile
	profileAdult := models.Profile{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        user.Name,
		AvatarColor: "marble",
		IsKids:      false,
		CreatedAt:   now,
	}
	profileKids := models.Profile{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        "Kids",
		AvatarColor: "moss",
		IsKids:      true,
		Pin:         "1234",
		CreatedAt:   now,
	}

	_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileAdult.ID, userID, profileAdult.Name, profileAdult.AvatarColor, profileAdult.IsKids, profileAdult.Pin, now)
	_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileKids.ID, userID, profileKids.Name, profileKids.AvatarColor, profileKids.IsKids, profileKids.Pin, now)

	_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'register', 'Account registered with email OTP verification', ?)", uuid.New().String(), userID, now)

	token, _ := middleware.GenerateToken(&user)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(AuthResponse{
		Token:    token,
		User:     user,
		Profiles: []models.Profile{profileAdult, profileKids},
	})
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" {
		identifier = strings.TrimSpace(req.Email)
	}
	if identifier == "" || req.Password == "" {
		http.Error(w, `{"error":"email/username and password are required"}`, http.StatusBadRequest)
		return
	}

	cleanID := strings.ToLower(identifier)
	var user models.User
	var passwordHash string

	err := database.DB.QueryRow(
		"SELECT id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?",
		cleanID, cleanID,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"invalid email/username or password"}`, http.StatusUnauthorized)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// Update last login and activity timestamp
	loginNow := time.Now()
	user.LastLoginAt = &loginNow
	user.LastActiveAt = &loginNow
	_, _ = database.DB.Exec("UPDATE users SET last_login_at = ?, last_active_at = ?, updated_at = ? WHERE id = ?", loginNow, loginNow, loginNow, user.ID)
	_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'login', 'User web login', ?)", uuid.New().String(), user.ID, loginNow)

	// Fetch user profiles
	rows, err := database.DB.Query("SELECT id, user_id, name, avatar_color, is_kids, pin, created_at FROM profiles WHERE user_id = ?", user.ID)
	profiles := []models.Profile{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p models.Profile
			_ = rows.Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarColor, &p.IsKids, &p.Pin, &p.CreatedAt)
			profiles = append(profiles, p)
		}
	}

	token, _ := middleware.GenerateToken(&user)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthResponse{
		Token:    token,
		User:     user,
		Profiles: profiles,
	})
}

func Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var user models.User
	var lastLogin, lastActive sql.NullTime
	err := database.DB.QueryRow(
		"SELECT id, email, name, subscription_tier, is_admin, last_login_at, last_active_at, created_at, updated_at FROM users WHERE id = ?",
		claims.UserID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &lastLogin, &lastActive, &user.CreatedAt, &user.UpdatedAt)
	if lastLogin.Valid {
		user.LastLoginAt = &lastLogin.Time
	}
	if lastActive.Valid {
		user.LastActiveAt = &lastActive.Time
	}

	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	rows, err := database.DB.Query("SELECT id, user_id, name, avatar_color, is_kids, pin, created_at FROM profiles WHERE user_id = ?", user.ID)
	profiles := []models.Profile{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p models.Profile
			_ = rows.Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarColor, &p.IsKids, &p.Pin, &p.CreatedAt)
			profiles = append(profiles, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user":     user,
		"profiles": profiles,
	})
}

type GoogleAuthRequest struct {
	Credential string `json:"credential"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Avatar     string `json:"avatar"`
}

type googleUserInfo struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func verifyGoogleToken(token string) (*googleUserInfo, error) {
	client := &http.Client{Timeout: 5 * time.Second}

	// 1. If token is a JWT ID token (three base64 segments)
	if strings.Count(token, ".") == 2 {
		resp, err := client.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(token))
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var idTokenInfo struct {
					Email         string `json:"email"`
					EmailVerified string `json:"email_verified"`
					Name          string `json:"name"`
					Picture       string `json:"picture"`
					Aud           string `json:"aud"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&idTokenInfo); err == nil && idTokenInfo.Email != "" {
					webAud := os.Getenv("GOOGLE_CLIENT_ID")
					androidAud := os.Getenv("GOOGLE_ANDROID_CLIENT_ID")
					if idTokenInfo.Aud != "" {
						valid := (webAud == "" && androidAud == "") ||
							(webAud != "" && idTokenInfo.Aud == webAud) ||
							(androidAud != "" && idTokenInfo.Aud == androidAud)
						if !valid {
							return nil, fmt.Errorf("Google token audience mismatch")
						}
					}
					return &googleUserInfo{
						Email:         idTokenInfo.Email,
						EmailVerified: idTokenInfo.EmailVerified == "true" || idTokenInfo.EmailVerified == "1",
						Name:          idTokenInfo.Name,
						Picture:       idTokenInfo.Picture,
					}, nil
				}
			}
		}
	}

	// 2. Otherwise verify as OAuth2 access token via Google userinfo endpoint
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google returned HTTP %d", resp.StatusCode)
	}

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

func GoogleAuth(w http.ResponseWriter, r *http.Request) {
	var req GoogleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Verify Google access token with Google UserInfo endpoint
	if req.Credential != "" {
		googleUser, err := verifyGoogleToken(req.Credential)
		if err == nil && googleUser != nil {
			if googleUser.Email != "" {
				// Use the server-verified email from Google
				req.Email = strings.ToLower(strings.TrimSpace(googleUser.Email))
			}
			if googleUser.Name != "" && req.Name == "" {
				req.Name = googleUser.Name
			}
		} else if os.Getenv("ENV") == "production" {
			http.Error(w, `{"error":"invalid or expired Google credential"}`, http.StatusUnauthorized)
			return
		}
	} else if os.Getenv("ENV") == "production" {
		http.Error(w, `{"error":"Google credential token is required"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, `{"error":"email is required for Google sign-in"}`, http.StatusBadRequest)
		return
	}

	now := time.Now()
	var user models.User
	var passwordHash string

	// Check if user already exists
	err := database.DB.QueryRow(
		"SELECT id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE email = ?",
		req.Email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Auto-register new user from Google
		userID := uuid.New().String()
		name := strings.TrimSpace(req.Name)
		if name == "" {
			name = strings.Split(req.Email, "@")[0]
		}
		dummyHash, _ := bcrypt.GenerateFromPassword([]byte(uuid.New().String()), bcrypt.DefaultCost)
		user = models.User{
			ID:               userID,
			Email:            req.Email,
			Name:             name,
			SubscriptionTier: models.TierFree,
			CreatedAt:        now,
			UpdatedAt:        now,
			LastLoginAt:      &now,
			LastActiveAt:     &now,
		}

		_, err = database.DB.Exec(
			"INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, last_login_at, last_active_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			user.ID, user.Email, string(dummyHash), user.Name, string(user.SubscriptionTier), false, now, now, now, now,
		)
		if err != nil {
			http.Error(w, `{"error":"failed creating user from Google account: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		// Create default adult profile and kids profile
		profileAdult := models.Profile{
			ID:          uuid.New().String(),
			UserID:      userID,
			Name:        user.Name,
			AvatarColor: "marble",
			IsKids:      false,
			CreatedAt:   now,
		}
		profileKids := models.Profile{
			ID:          uuid.New().String(),
			UserID:      userID,
			Name:        "Kids",
			AvatarColor: "moss",
			IsKids:      true,
			Pin:         "1234",
			CreatedAt:   now,
		}
		_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileAdult.ID, userID, profileAdult.Name, profileAdult.AvatarColor, profileAdult.IsKids, profileAdult.Pin, now)
		_, _ = database.DB.Exec("INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", profileKids.ID, userID, profileKids.Name, profileKids.AvatarColor, profileKids.IsKids, profileKids.Pin, now)
		_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'login', 'Google signup & login', ?)", uuid.New().String(), user.ID, now)

		token, _ := middleware.GenerateToken(&user)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(AuthResponse{
			Token:    token,
			User:     user,
			Profiles: []models.Profile{profileAdult, profileKids},
		})
		return
	} else if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Existing user - update login time
	user.LastLoginAt = &now
	user.LastActiveAt = &now
	_, _ = database.DB.Exec("UPDATE users SET last_login_at = ?, last_active_at = ?, updated_at = ? WHERE id = ?", now, now, now, user.ID)
	_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'login', 'Google login', ?)", uuid.New().String(), user.ID, now)

	// Fetch user profiles
	rows, err := database.DB.Query("SELECT id, user_id, name, avatar_color, is_kids, pin, created_at FROM profiles WHERE user_id = ?", user.ID)
	profiles := []models.Profile{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p models.Profile
			_ = rows.Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarColor, &p.IsKids, &p.Pin, &p.CreatedAt)
			profiles = append(profiles, p)
		}
	}

	token, _ := middleware.GenerateToken(&user)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthResponse{
		Token:    token,
		User:     user,
		Profiles: profiles,
	})
}

type ForgotPasswordRequestRequest struct {
	Email string `json:"email"` // Accepts email or username
}

type ForgotPasswordResetRequest struct {
	Email       string `json:"email"`
	Otp         string `json:"otp"`
	NewPassword string `json:"new_password"`
}

func ForgotPasswordRequest(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	clean := strings.TrimSpace(strings.ToLower(req.Email))
	if clean == "" {
		http.Error(w, `{"error":"email or username is required"}`, http.StatusBadRequest)
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, email, name, subscription_tier, is_admin, created_at, updated_at FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?",
		clean, clean,
	).Scan(&user.ID, &user.Email, &user.Name, &user.SubscriptionTier, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt)

	if err == nil {
		// Generate cryptographically secure 6-digit OTP
		otpNum, _ := cryptoRandInt(100000, 999999)
		otpCode := fmt.Sprintf("%06d", otpNum)
		expiresAt := time.Now().Add(15 * time.Minute)

		// Invalidate any older unverified password reset OTPs for this user
		_, _ = database.DB.Exec("UPDATE user_otps SET verified = 1 WHERE user_id = ? AND purpose = 'password_reset'", user.ID)

		// Insert new OTP record
		otpID := uuid.New().String()
		_, _ = database.DB.Exec(
			"INSERT INTO user_otps (id, user_id, email, otp_code, purpose, expires_at, verified, created_at) VALUES (?, ?, ?, ?, 'password_reset', ?, 0, ?)",
			otpID, user.ID, user.Email, otpCode, expiresAt, time.Now(),
		)

		// Send email via mail service (Bird API / SMTP)
		_ = mail.SendPasswordResetOTP(user.Email, user.Name, otpCode)
	}

	// Always return uniform message to prevent account enumeration
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "If that account exists, a 6-digit verification code has been dispatched to your email address.",
	})
}

func ForgotPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	clean := strings.TrimSpace(strings.ToLower(req.Email))
	otp := strings.TrimSpace(req.Otp)
	newPassword := strings.TrimSpace(req.NewPassword)

	if clean == "" || otp == "" || len(newPassword) < 6 {
		http.Error(w, `{"error":"email/username, 6-digit OTP, and new password (min 6 chars) are required"}`, http.StatusBadRequest)
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, email, name FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?",
		clean, clean,
	).Scan(&user.ID, &user.Email, &user.Name)

	if err != nil {
		http.Error(w, `{"error":"invalid email or OTP code"}`, http.StatusBadRequest)
		return
	}

	// Verify OTP
	var otpID string
	err = database.DB.QueryRow(
		"SELECT id FROM user_otps WHERE user_id = ? AND purpose = 'password_reset' AND otp_code = ? AND verified = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
		user.ID, otp, time.Now(),
	).Scan(&otpID)

	if err != nil {
		http.Error(w, `{"error":"that verification code is incorrect or has expired. Please request a new code."}`, http.StatusBadRequest)
		return
	}

	// Mark OTP verified
	_, _ = database.DB.Exec("UPDATE user_otps SET verified = 1 WHERE id = ?", otpID)

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed hashing password"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now()
	_, err = database.DB.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", string(hashedPassword), now, user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed updating password"}`, http.StatusInternalServerError)
		return
	}

	_, _ = database.DB.Exec("INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'password_reset', 'Password reset via email OTP', ?)", uuid.New().String(), user.ID, now)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Password updated successfully! You can now sign in with your new password.",
	})
}

func cryptoRandInt(min, max int64) (int64, error) {
	nBig, err := cryptoRand.Int(cryptoRand.Reader, big.NewInt(max-min+1))
	if err != nil {
		return min, err
	}
	return nBig.Int64() + min, nil
}


