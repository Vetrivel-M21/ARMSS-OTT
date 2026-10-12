package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// MaxDevicesPerUser defines the maximum number of registered devices per user account.
const MaxDevicesPerUser = 5

// Stream concurrency limits per subscription tier.
const (
	MaxStreamsFree     = 1
	MaxStreamsStandard = 2
	MaxStreamsPremium  = 4
)

// PlaybackTicketResponse represents the response of GET /videos/:id/playback.
type PlaybackTicketResponse struct {
	ManifestURL       string  `json:"manifestUrl"`
	MaxHeight         int     `json:"maxHeight"`
	ResumePositionSec float64 `json:"resumePositionSec"`
}

// PlaybackTokenClaims represents the claims inside the short-lived signed playback token.
type PlaybackTokenClaims struct {
	UserID     string `json:"sub"`
	VideoID    string `json:"vid"`
	DeviceID   string `json:"dev"`
	ClientType string `json:"cli"`
	MaxHeight  int    `json:"hgt"`
	jwt.RegisteredClaims
}

// WatchProgressRequest represents payload for POST /videos/:id/progress.
type WatchProgressRequest struct {
	TimeSeconds     float64 `json:"time_seconds"`
	ProgressPercent float64 `json:"progress_percent"`
	ProfileID       string  `json:"profile_id,omitempty"`
	DeviceID        string  `json:"device_id,omitempty"`
}

// StreamHeartbeatRequest represents payload for POST /videos/:id/heartbeat.
type StreamHeartbeatRequest struct {
	SessionID string `json:"session_id"`
	DeviceID  string `json:"device_id"`
}

// UserDevice represents a registered device in user_devices table.
type UserDevice struct {
	ID         string    `json:"id" db:"id"`
	UserID     string    `json:"user_id" db:"user_id"`
	DeviceID   string    `json:"device_id" db:"device_id"`
	DeviceName string    `json:"device_name" db:"device_name"`
	ClientType string    `json:"client_type" db:"client_type"`
	LastUsedAt time.Time `json:"last_used_at" db:"last_used_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// PlaybackSession represents an active streaming session in playback_sessions table.
type PlaybackSession struct {
	SessionID       string    `json:"session_id" db:"session_id"`
	UserID          string    `json:"user_id" db:"user_id"`
	DeviceID        string    `json:"device_id" db:"device_id"`
	VideoID         string    `json:"video_id" db:"video_id"`
	LastHeartbeatAt time.Time `json:"last_heartbeat_at" db:"last_heartbeat_at"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}
