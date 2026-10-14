package access

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

var istLocation *time.Location

func init() {
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		// Fallback fixed zone for Asia/Kolkata (UTC +05:30)
		loc = time.FixedZone("IST", 5*3600+30*60)
	}
	istLocation = loc
}

// IsPlanAccessEnabled returns true if the plan-based access feature flag is active.
func IsPlanAccessEnabled() bool {
	return strings.EqualFold(os.Getenv("ENABLE_PLAN_ACCESS"), "true")
}

// GetISTWatchDate formats the given timestamp as YYYY-MM-DD in Asia/Kolkata.
func GetISTWatchDate(t time.Time) string {
	return t.In(istLocation).Format("2006-01-02")
}

// Plan represents a subscription tier plan with quotas and capabilities.
type Plan struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	PriceINR          int    `json:"price_inr"`
	BillingPeriod     string `json:"billing_period"`
	DailyMovieLimit   int    `json:"daily_movie_limit"`
	DailyEpisodeLimit int    `json:"daily_episode_limit"`
	MaxQuality        int    `json:"max_quality"`
	MaxDevices        int    `json:"max_devices"`
	RazorpayPlanID    string `json:"razorpay_plan_id"`
	IsActive          bool   `json:"is_active"`
}

// AuthorizationResult represents the outcome of an access authorization request.
type AuthorizationResult struct {
	Allowed              bool   `json:"allowed"`
	Reason               string `json:"reason,omitempty"`
	Message              string `json:"message,omitempty"`
	Plan                 *Plan  `json:"plan,omitempty"`
	MaxQuality           int    `json:"max_quality,omitempty"`
	AlreadyWatchedToday  bool   `json:"already_watched_today,omitempty"`
	WatchedTodayCount    int    `json:"watched_today_count,omitempty"`
	DailyLimit           int    `json:"daily_limit,omitempty"`
}

// GetUserPlan resolves the effective plan for a user.
// 1. Checks active paid subscription in user_subscriptions.
// 2. Grandfathers existing users by users.subscription_tier.
// 3. Defaults to the 'free' plan (price 0).
func GetUserPlan(ctx context.Context, db *sql.DB, userID string) (*Plan, error) {
	// 1. Check active subscription in user_subscriptions
	subQuery := `
		SELECT p.id, p.name, p.price_inr, p.billing_period, p.daily_movie_limit, p.daily_episode_limit, 
		       p.max_quality, p.max_devices, p.razorpay_plan_id, p.is_active
		FROM user_subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.user_id = ? AND s.status = 'active' AND s.current_period_end > NOW()
		ORDER BY s.current_period_end DESC
		LIMIT 1`

	var plan Plan
	err := db.QueryRowContext(ctx, subQuery, userID).Scan(
		&plan.ID, &plan.Name, &plan.PriceINR, &plan.BillingPeriod,
		&plan.DailyMovieLimit, &plan.DailyEpisodeLimit,
		&plan.MaxQuality, &plan.MaxDevices, &plan.RazorpayPlanID, &plan.IsActive,
	)
	if err == nil {
		return &plan, nil
	}

	// 2. Check users.subscription_tier for legacy paying users (grandfathering)
	var legacyTier string
	_ = db.QueryRowContext(ctx, "SELECT subscription_tier FROM users WHERE id = ?", userID).Scan(&legacyTier)

	if legacyTier == "standard" || legacyTier == "premium" {
		tierQuery := `
			SELECT id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, 
			       max_quality, max_devices, razorpay_plan_id, is_active
			FROM plans 
			WHERE id = ? AND is_active = TRUE`
		if tierErr := db.QueryRowContext(ctx, tierQuery, legacyTier).Scan(
			&plan.ID, &plan.Name, &plan.PriceINR, &plan.BillingPeriod,
			&plan.DailyMovieLimit, &plan.DailyEpisodeLimit,
			&plan.MaxQuality, &plan.MaxDevices, &plan.RazorpayPlanID, &plan.IsActive,
		); tierErr == nil {
			return &plan, nil
		}
	}

	// 3. Fallback to 'free' plan
	freeQuery := `
		SELECT id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, 
		       max_quality, max_devices, razorpay_plan_id, is_active
		FROM plans 
		WHERE id = 'free'`
	if freeErr := db.QueryRowContext(ctx, freeQuery).Scan(
		&plan.ID, &plan.Name, &plan.PriceINR, &plan.BillingPeriod,
		&plan.DailyMovieLimit, &plan.DailyEpisodeLimit,
		&plan.MaxQuality, &plan.MaxDevices, &plan.RazorpayPlanID, &plan.IsActive,
	); freeErr == nil {
		return &plan, nil
	}

	// Default fallback in-memory Free plan if table lookup failed
	return &Plan{
		ID:                "free",
		Name:              "Free Member",
		PriceINR:          0,
		BillingPeriod:     "monthly",
		DailyMovieLimit:   1,
		DailyEpisodeLimit: 2,
		MaxQuality:        720,
		MaxDevices:        1,
		IsActive:          true,
	}, nil
}

// AuthorizePlayback validates content access, daily quotas, and resolves playback quality.
func AuthorizePlayback(ctx context.Context, db *sql.DB, userID, videoID, clientType string) (*AuthorizationResult, error) {
	// If feature flag is disabled, bypass all restrictions
	if !IsPlanAccessEnabled() {
		return &AuthorizationResult{
			Allowed:    true,
			MaxQuality: 2160,
		}, nil
	}

	plan, err := GetUserPlan(ctx, db, userID)
	if err != nil {
		return nil, fmt.Errorf("resolving user plan: %w", err)
	}

	// 1. Inspect target content
	var (
		contentID    string
		contentType  string // "movie" or "episode"
		requiredTier string
		freeEpisodes int
		epNumber     int
	)

	// Check if videoID is in titles (movies / standalone titles)
	var titleReqTier sql.NullString
	titleErr := db.QueryRowContext(ctx, "SELECT id, required_tier, free_episodes FROM titles WHERE id = ?", videoID).Scan(&contentID, &titleReqTier, &freeEpisodes)
	if titleErr == nil {
		contentType = "movie"
		if titleReqTier.Valid {
			requiredTier = titleReqTier.String
		}
	} else {
		// Check episodes table
		var epTitleID string
		epErr := db.QueryRowContext(ctx, "SELECT id, title_id, episode_number FROM episodes WHERE id = ?", videoID).Scan(&contentID, &epTitleID, &epNumber)
		if epErr == nil {
			contentType = "episode"
			_ = db.QueryRowContext(ctx, "SELECT required_tier, free_episodes FROM titles WHERE id = ?", epTitleID).Scan(&titleReqTier, &freeEpisodes)
			if titleReqTier.Valid {
				requiredTier = titleReqTier.String
			}
		} else {
			// Video table (custom uploaded video, treated as free content)
			contentID = videoID
			contentType = "movie"
			requiredTier = "free"
		}
	}

	if requiredTier == "" {
		requiredTier = "free"
	}

	// 2. Entitlement / Free Episodes Check
	if plan.ID == "free" {
		// Premium content requires paid subscription
		if requiredTier != "free" {
			return &AuthorizationResult{
				Allowed: false,
				Reason:  "premium_content_required",
				Message: "This title requires an active subscription.",
				Plan:    plan,
			}, nil
		}

		// Series free episode boundary check
		if contentType == "episode" && freeEpisodes > 0 && epNumber > freeEpisodes {
			return &AuthorizationResult{
				Allowed: false,
				Reason:  "free_episodes_exceeded",
				Message: fmt.Sprintf("Free access is limited to the first %d episodes. Please upgrade to continue watching.", freeEpisodes),
				Plan:    plan,
			}, nil
		}
	}

	// 3. Daily Watch Limit & Same-Day Rewatch Check
	watchDate := GetISTWatchDate(time.Now())

	// Check if already watched today (resuming or rewatching same title costs nothing)
	var existingRecordID string
	err = db.QueryRowContext(ctx,
		"SELECT id FROM daily_watch_records WHERE user_id = ? AND watch_date = ? AND content_id = ?",
		userID, watchDate, contentID,
	).Scan(&existingRecordID)

	alreadyWatched := (err == nil)

	if !alreadyWatched {
		// First start today — verify quota
		var countToday int
		err = db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM daily_watch_records WHERE user_id = ? AND watch_date = ? AND content_type = ?",
			userID, watchDate, contentType,
		).Scan(&countToday)
		if err != nil {
			return nil, fmt.Errorf("querying daily watch count: %w", err)
		}

		limit := plan.DailyMovieLimit
		limitType := "movie"
		if contentType == "episode" {
			limit = plan.DailyEpisodeLimit
			limitType = "episode"
		}

		if countToday >= limit {
			return &AuthorizationResult{
				Allowed:           false,
				Reason:            fmt.Sprintf("daily_%s_limit_reached", limitType),
				Message:           fmt.Sprintf("You have reached your daily %s limit of %d (resets at midnight IST).", limitType, limit),
				Plan:              plan,
				WatchedTodayCount: countToday,
				DailyLimit:        limit,
			}, nil
		}

		// Consume quota by recording start
		recordID := uuid.NewString()
		_, _ = db.ExecContext(ctx,
			`INSERT IGNORE INTO daily_watch_records (id, user_id, watch_date, content_id, content_type, first_started_at)
			 VALUES (?, ?, ?, ?, ?, NOW())`,
			recordID, userID, watchDate, contentID, contentType,
		)
	}

	// 4. Quality Ceiling
	maxQuality := plan.MaxQuality
	if clientType == "mobile" && maxQuality > 1080 {
		// Mobile caps at 1080p by default per project constraints
		maxQuality = 1080
	}

	return &AuthorizationResult{
		Allowed:             true,
		Plan:                plan,
		MaxQuality:          maxQuality,
		AlreadyWatchedToday: alreadyWatched,
	}, nil
}
