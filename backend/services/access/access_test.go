package access

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

func TestISTWatchDate(t *testing.T) {
	// 2026-10-12 19:00:00 UTC is 2026-10-13 00:30:00 IST (+5:30)
	utcTime := time.Date(2026, 10, 12, 19, 0, 0, 0, time.UTC)
	istDate := GetISTWatchDate(utcTime)
	if istDate != "2026-10-13" {
		t.Errorf("expected 2026-10-13 in IST, got %s", istDate)
	}

	// 2026-10-12 18:29:00 UTC is 2026-10-12 23:59:00 IST
	utcTime2 := time.Date(2026, 10, 12, 18, 29, 0, 0, time.UTC)
	istDate2 := GetISTWatchDate(utcTime2)
	if istDate2 != "2026-10-12" {
		t.Errorf("expected 2026-10-12 in IST, got %s", istDate2)
	}
}

func TestFeatureFlagBypass(t *testing.T) {
	_ = os.Unsetenv("ENABLE_PLAN_ACCESS")
	if IsPlanAccessEnabled() {
		t.Fatal("expected IsPlanAccessEnabled to be false when unset")
	}

	res, err := AuthorizePlayback(context.Background(), nil, "any-user", "any-video", "web")
	if err != nil {
		t.Fatalf("unexpected error when flag disabled: %v", err)
	}
	if !res.Allowed {
		t.Errorf("expected playback to be allowed when feature flag is off")
	}
}

func TestPlanAccessService_MySQL(t *testing.T) {
	testDSN := strings.TrimSpace(os.Getenv("PLAN_ACCESS_TEST_MYSQL_DSN"))
	if testDSN == "" {
		t.Skip("skipping MySQL access service tests: PLAN_ACCESS_TEST_MYSQL_DSN is not set (dedicated test database required, e.g. armss_ott_test)")
		return
	}

	if strings.Contains(testDSN, "/armss_ott?") || strings.HasSuffix(testDSN, "/armss_ott") {
		t.Fatal("SAFETY VIOLATION: PLAN_ACCESS_TEST_MYSQL_DSN must point to a dedicated test database, never dev or prod")
	}

	db, err := sql.Open("mysql", testDSN)
	if err != nil {
		t.Fatalf("failed connecting to MySQL test DB: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// Enable flag for test
	_ = os.Setenv("ENABLE_PLAN_ACCESS", "true")
	defer func() {
		_ = os.Unsetenv("ENABLE_PLAN_ACCESS")
	}()

	// Ensure episodes table exists in test DB
	_, _ = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS episodes (
			id VARCHAR(100) PRIMARY KEY,
			title_id VARCHAR(100) NOT NULL,
			season_number INT NOT NULL DEFAULT 1,
			episode_number INT NOT NULL,
			title VARCHAR(255) NOT NULL,
			runtime_min INT NOT NULL DEFAULT 0,
			synopsis TEXT,
			video_url TEXT NOT NULL,
			thumbnail_url TEXT,
			created_at DATETIME NOT NULL,
			FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
	`)

	// 1. Setup Test Data
	userID := "test_user_" + uuid.NewString()[:8]
	legacyPaidUserID := "legacy_paid_" + uuid.NewString()[:8]

	_, err = db.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at)
		 VALUES (?, ?, 'hash', 'Test Free User', 'free', FALSE, NOW(), NOW())`,
		userID, userID+"@example.com",
	)
	if err != nil {
		t.Fatalf("creating test free user: %v", err)
	}

	_, err = db.ExecContext(ctx,
		`INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at)
		 VALUES (?, ?, 'hash', 'Test Legacy User', 'standard', FALSE, NOW(), NOW())`,
		legacyPaidUserID, legacyPaidUserID+"@example.com",
	)
	if err != nil {
		t.Fatalf("creating test legacy paid user: %v", err)
	}

	// Create test series with free_episodes = 2
	seriesID := "series_" + uuid.NewString()[:8]
	_, err = db.ExecContext(ctx,
		`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, tone, required_tier, genres, badges, free_episodes)
		 VALUES (?, 'Test Series', 'series', 2026, '13+', 45, 95, 'logline', 'synopsis', 'poster', 'backdrop', 'Drama', 'free', 'Drama', 'HD', 2)`,
		seriesID,
	)
	if err != nil {
		t.Fatalf("creating test series: %v", err)
	}

	// Create 3 episodes for this series
	ep1ID := "ep1_" + uuid.NewString()[:8]
	ep2ID := "ep2_" + uuid.NewString()[:8]
	ep3ID := "ep3_" + uuid.NewString()[:8]

	_, _ = db.ExecContext(ctx, `INSERT INTO episodes (id, title_id, episode_number, title, video_url, created_at) VALUES (?, ?, 1, 'Ep 1', 'https://example.com/ep1', NOW())`, ep1ID, seriesID)
	_, _ = db.ExecContext(ctx, `INSERT INTO episodes (id, title_id, episode_number, title, video_url, created_at) VALUES (?, ?, 2, 'Ep 2', 'https://example.com/ep2', NOW())`, ep2ID, seriesID)
	_, _ = db.ExecContext(ctx, `INSERT INTO episodes (id, title_id, episode_number, title, video_url, created_at) VALUES (?, ?, 3, 'Ep 3', 'https://example.com/ep3', NOW())`, ep3ID, seriesID)

	// Create test movies
	movie1ID := "movie1_" + uuid.NewString()[:8]
	movie2ID := "movie2_" + uuid.NewString()[:8]
	_, _ = db.ExecContext(ctx,
		`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, tone, required_tier, genres, badges, free_episodes)
		 VALUES (?, 'Movie 1', 'movie', 2026, '13+', 120, 90, 'log', 'syn', 'p', 'b', 'Action', 'free', 'Action', 'HD', 0)`,
		movie1ID,
	)
	_, _ = db.ExecContext(ctx,
		`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, tone, required_tier, genres, badges, free_episodes)
		 VALUES (?, 'Movie 2', 'movie', 2026, '13+', 120, 90, 'log', 'syn', 'p', 'b', 'Action', 'free', 'Action', 'HD', 0)`,
		movie2ID,
	)

	// 2. Test Grandfathering: Legacy paid user resolves 'standard' plan
	legacyPlan, err := GetUserPlan(ctx, db, legacyPaidUserID)
	if err != nil {
		t.Fatalf("resolving legacy paid user plan: %v", err)
	}
	if legacyPlan.ID != "standard" || legacyPlan.DailyMovieLimit != 5 {
		t.Errorf("expected legacy user grandfathered to standard (5 movies), got %s (%d movies)", legacyPlan.ID, legacyPlan.DailyMovieLimit)
	}

	// 3. Test Series Free Episodes Rule:
	// Free user can watch Ep 1 (within free_episodes=2)
	resEp1, err := AuthorizePlayback(ctx, db, userID, ep1ID, "web")
	if err != nil || !resEp1.Allowed {
		t.Fatalf("expected Ep 1 allowed for free user, got allowed=%v, err=%v", resEp1.Allowed, err)
	}

	// Free user tries Ep 3 (exceeds free_episodes=2) -> should be denied
	resEp3, err := AuthorizePlayback(ctx, db, userID, ep3ID, "web")
	if err != nil || resEp3.Allowed {
		t.Fatalf("expected Ep 3 denied for free user (free_episodes=2), got allowed=%v", resEp3.Allowed)
	}
	if resEp3.Reason != "free_episodes_exceeded" {
		t.Errorf("expected reason free_episodes_exceeded, got %s", resEp3.Reason)
	}

	// 4. Test Daily Limit & Same-Day Rewatch:
	// Free user watches Movie 1 for the first time -> allowed
	resM1, err := AuthorizePlayback(ctx, db, userID, movie1ID, "web")
	if err != nil || !resM1.Allowed {
		t.Fatalf("expected Movie 1 allowed on first start, got allowed=%v, err=%v", resM1.Allowed, err)
	}

	// Free user rewatches/resumes Movie 1 on same day -> allowed for free!
	resM1Rewatch, err := AuthorizePlayback(ctx, db, userID, movie1ID, "web")
	if err != nil || !resM1Rewatch.Allowed || !resM1Rewatch.AlreadyWatchedToday {
		t.Fatalf("expected Movie 1 rewatch allowed with AlreadyWatchedToday=true, got allowed=%v, alreadyWatched=%v", resM1Rewatch.Allowed, resM1Rewatch.AlreadyWatchedToday)
	}

	// Free user tries to start Movie 2 (daily limit for free is 1 movie) -> denied!
	resM2, err := AuthorizePlayback(ctx, db, userID, movie2ID, "web")
	if err != nil || resM2.Allowed {
		t.Fatalf("expected Movie 2 denied (daily movie limit reached), got allowed=%v", resM2.Allowed)
	}
	if resM2.Reason != "daily_movie_limit_reached" {
		t.Errorf("expected reason daily_movie_limit_reached, got %s", resM2.Reason)
	}

	// 5. Test Quality Ceiling & Mobile Cap
	resQualityWeb, _ := AuthorizePlayback(ctx, db, legacyPaidUserID, movie1ID, "web")
	if resQualityWeb.MaxQuality != 1080 {
		t.Errorf("expected 1080p for standard plan on web, got %d", resQualityWeb.MaxQuality)
	}

	resQualityMobile, _ := AuthorizePlayback(ctx, db, legacyPaidUserID, movie1ID, "mobile")
	if resQualityMobile.MaxQuality > 1080 {
		t.Errorf("expected mobile quality capped at 1080p, got %d", resQualityMobile.MaxQuality)
	}
}
