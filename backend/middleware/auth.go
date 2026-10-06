package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"armss-ott-backend/models"
	"github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("armss-ott-super-secret-jwt-key-2026")

func init() {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		JWTSecret = []byte(s)
	}
}

type ContextKey string

const (
	UserContextKey ContextKey = "user"
)

type Claims struct {
	UserID           string                  `json:"user_id"`
	Email            string                  `json:"email"`
	SubscriptionTier models.SubscriptionTier `json:"subscription_tier"`
	IsAdmin          bool                    `json:"is_admin"`
	jwt.RegisteredClaims
}

// GenerateToken generates JWT access token
func GenerateToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:           user.ID,
		Email:            user.Email,
		SubscriptionTier: user.SubscriptionTier,
		IsAdmin:          user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "armss-ott",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// RequireAuth middleware verifies Bearer token
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
			return JWTSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuth attaches claims if token is present, but doesn't block unauthenticated guests
func OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				claims := &Claims{}
				token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
					return JWTSecret, nil
				})
				if err == nil && token.Valid {
					ctx := context.WithValue(r.Context(), UserContextKey, claims)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin middleware allows only admin users
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := GetUserFromContext(r)
		if claims == nil {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if !claims.IsAdmin {
			http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetUserFromContext extracts claims from request context
func GetUserFromContext(r *http.Request) *Claims {
	val := r.Context().Value(UserContextKey)
	if val == nil {
		return nil
	}
	if claims, ok := val.(*Claims); ok {
		return claims
	}
	return nil
}

