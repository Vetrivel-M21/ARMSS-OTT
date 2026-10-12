package models

import "time"

// SubscriptionTier represents access level
type SubscriptionTier string

const (
	TierFree     SubscriptionTier = "free"
	TierStandard SubscriptionTier = "standard"
	TierPremium  SubscriptionTier = "premium"
)

// User represents an account holder
type User struct {
	ID               string           `json:"id"`
	Email            string           `json:"email"`
	PasswordHash     string           `json:"-"`
	Name             string           `json:"name"`
	SubscriptionTier SubscriptionTier `json:"subscription_tier"`
	IsAdmin          bool             `json:"is_admin"`
	LastLoginAt      *time.Time       `json:"last_login_at,omitempty"`
	LastActiveAt     *time.Time       `json:"last_active_at,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

// UserActivityLog stores user login and session activity
type UserActivityLog struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"` // "login", "watch", "upgrade"
	Details   string    `json:"details,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// UserAnalyticsItem represents an individual user's watch time & activity profile
type UserAnalyticsItem struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	SubscriptionTier   string     `json:"subscription_tier"`
	IsAdmin            bool       `json:"is_admin"`
	CreatedAt          time.Time  `json:"created_at"`
	LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
	LastActiveAt       *time.Time `json:"last_active_at,omitempty"`
	TotalWatchSeconds  float64    `json:"total_watch_seconds"`
	TitlesWatchedCount int        `json:"titles_watched_count"`
	CompletionRate     float64    `json:"completion_rate"`
}

// DailyActiveTrend represents DAU and watch hours for a single day
type DailyActiveTrend struct {
	Date        string  `json:"date"`
	Label       string  `json:"label"`
	ActiveUsers int     `json:"active_users"`
	Logins      int     `json:"logins"`
	WatchHours  float64 `json:"watch_hours"`
}

// TopWatchedTitle represents top watched content
type TopWatchedTitle struct {
	TitleID         string  `json:"title_id"`
	Title           string  `json:"title"`
	Poster          string  `json:"poster"`
	Kind            string  `json:"kind"`
	TotalWatchHours float64 `json:"total_watch_hours"`
	ViewerCount     int     `json:"viewer_count"`
	CompletionRate  float64 `json:"completion_rate"`
}

// Profile represents a viewing profile under a user account
type Profile struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	AvatarColor string    `json:"avatar_color"`
	IsKids      bool      `json:"is_kids"`
	Pin         string    `json:"pin,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Episode represents a single episode of a series
type Episode struct {
	ID           string    `json:"id"`
	TitleID      string    `json:"title_id"`
	SeasonNumber int       `json:"season_number"`
	EpisodeNumber int      `json:"episode_number"`
	Title        string    `json:"title"`
	RuntimeMin   int       `json:"runtime_min"`
	Synopsis     string    `json:"synopsis"`
	VideoURL     string    `json:"video_url"`
	ThumbnailURL string    `json:"thumbnail_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Title represents movie/series catalog item
type Title struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Kind        string           `json:"kind"` // "film", "series", "live", "documentary"
	Year        int              `json:"year"`
	Maturity    string           `json:"maturity"` // "G", "PG", "12", "15", "18"
	RuntimeMin  int              `json:"runtime_min"`
	Match       int              `json:"match"`
	Logline     string           `json:"logline"`
	Synopsis    string           `json:"synopsis"`
	Poster      string           `json:"poster"`
	Backdrop    string           `json:"backdrop"`
	Trailer     string           `json:"trailer,omitempty"`
	VideoURL    string           `json:"video_url,omitempty"`
	Tone        string           `json:"tone"`
	Original    bool             `json:"original"`
	Kids        bool             `json:"kids"`
	RequiredTier SubscriptionTier `json:"required_tier"` // "free", "standard", "premium"
	Genres       []string         `json:"genres"`
	Badges       []string         `json:"badges"`
	Featured     bool             `json:"featured"`
	Trending     bool             `json:"trending"`
	Rank         *int             `json:"rank,omitempty"`
	Episodes     []Episode        `json:"episodes,omitempty"`
}

// WatchlistEntry represents a saved title
type WatchlistEntry struct {
	UserID    string    `json:"user_id"`
	ProfileID string    `json:"profile_id"`
	TitleID   string    `json:"title_id"`
	AddedAt   time.Time `json:"added_at"`
}

// WatchProgress stores playback resume state
type WatchProgress struct {
	UserID          string    `json:"user_id"`
	ProfileID       string    `json:"profile_id"`
	TitleID         string    `json:"title_id"`
	EpisodeID       string    `json:"episode_id,omitempty"`
	ProgressPercent float64   `json:"progress_percent"`
	TimeSeconds     float64   `json:"time_seconds"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Rating represents a user thumbs-up / thumbs-down
type Rating struct {
	UserID    string    `json:"user_id"`
	TitleID   string    `json:"title_id"`
	Score     int       `json:"score"` // 1 = Thumbs Up, -1 = Thumbs Down
	UpdatedAt time.Time `json:"updated_at"`
}

// PlanInfo describes subscription tiers
type PlanInfo struct {
	Tier         SubscriptionTier `json:"tier"`
	Name         string           `json:"name"`
	PriceMonthly string           `json:"price_monthly"`
	PriceAnnual  string           `json:"price_annual"`
	Resolution   string           `json:"resolution"`
	Devices      int              `json:"devices"`
	AdFree       bool             `json:"ad_free"`
	Downloads    bool             `json:"downloads"`
	LiveSports   bool             `json:"live_sports"`
	Originals    bool             `json:"originals"`
}

// HistoryItem represents an entry in the user's viewing history
type HistoryItem struct {
	TitleID         string    `json:"title_id"`
	Title           string    `json:"title"`
	Poster          string    `json:"poster"`
	Backdrop        string    `json:"backdrop"`
	Kind            string    `json:"kind"`
	RuntimeMin      int       `json:"runtime_min"`
	EpisodeID       string    `json:"episode_id,omitempty"`
	ProgressPercent float64   `json:"progress_percent"`
	TimeSeconds     float64   `json:"time_seconds"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// UserWatchedTitleDetail represents an individual title watched by a user for admin drilldown
type UserWatchedTitleDetail struct {
	TitleID         string    `json:"title_id"`
	Title           string    `json:"title"`
	Poster          string    `json:"poster"`
	Kind            string    `json:"kind"`
	EpisodeID       string    `json:"episode_id,omitempty"`
	ProgressPercent float64   `json:"progress_percent"`
	TimeSeconds     float64   `json:"time_seconds"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// UserDetailResponse represents complete analytics & profile drill-down for an admin
type UserDetailResponse struct {
	User               User                    `json:"user"`
	TotalWatchSeconds  float64                 `json:"total_watch_seconds"`
	TitlesWatchedCount int                     `json:"titles_watched_count"`
	CompletionRate     float64                 `json:"completion_rate"`
	WatchedTitles      []UserWatchedTitleDetail `json:"watched_titles"`
	ActivityLogs       []UserActivityLog       `json:"activity_logs"`
	WatchlistTitles    []string                `json:"watchlist_titles"`
	Ratings            []Rating                `json:"ratings"`
}

