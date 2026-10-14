package database

import (
	"database/sql"
	"os"
	"strings"
	"testing"

	_ "github.com/go-sql-driver/mysql"
)

// TestPlanAccessMigrations_MySQL runs exclusively against a dedicated MySQL test database.
// It skips automatically if PLAN_ACCESS_TEST_MYSQL_DSN is not set.
func TestPlanAccessMigrations_MySQL(t *testing.T) {
	testDSN := strings.TrimSpace(os.Getenv("PLAN_ACCESS_TEST_MYSQL_DSN"))
	if testDSN == "" {
		t.Skip("skipping MySQL migration test: PLAN_ACCESS_TEST_MYSQL_DSN is not set (dedicated test database required, e.g. armss_ott_test)")
		return
	}

	// Safety check: Ensure test DSN never points to development or production database
	if strings.Contains(testDSN, "/armss_ott?") || strings.HasSuffix(testDSN, "/armss_ott") {
		t.Fatal("SAFETY VIOLATION: PLAN_ACCESS_TEST_MYSQL_DSN must point to a dedicated test database (e.g. armss_ott_test), never dev or prod database")
	}

	db, err := sql.Open("mysql", testDSN)
	if err != nil {
		t.Fatalf("failed to connect to MySQL test DB: %v", err)
	}
	defer db.Close()

	if pingErr := db.Ping(); pingErr != nil {
		t.Fatalf("unable to ping MySQL test DB: %v", pingErr)
	}

	// Assign to package-level DB pointer during test
	oldDB := DB
	oldDriver := DriverName
	DB = db
	DriverName = "mysql"
	defer func() {
		DB = oldDB
		DriverName = oldDriver
	}()

	// 1. Ensure minimal base schemas exist in test DB for foreign keys
	baseSchemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(64) PRIMARY KEY,
			email VARCHAR(191) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			name VARCHAR(100) NOT NULL,
			subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
			is_admin BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

		`CREATE TABLE IF NOT EXISTS titles (
			id VARCHAR(100) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			kind VARCHAR(50) NOT NULL,
			year INT NOT NULL,
			maturity VARCHAR(20) NOT NULL,
			runtime_min INT NOT NULL,
			match_percent INT NOT NULL,
			logline TEXT NOT NULL,
			synopsis TEXT NOT NULL,
			poster TEXT NOT NULL,
			backdrop TEXT NOT NULL,
			trailer TEXT,
			video_url TEXT,
			tone VARCHAR(50) NOT NULL,
			original BOOLEAN NOT NULL DEFAULT FALSE,
			kids BOOLEAN NOT NULL DEFAULT FALSE,
			required_tier VARCHAR(50) NOT NULL DEFAULT 'free',
			genres TEXT NOT NULL,
			badges TEXT NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,
	}

	for _, s := range baseSchemas {
		if _, err := DB.Exec(s); err != nil {
			t.Fatalf("failed initializing test base schema: %v", err)
		}
	}

	// 2. Run migration 3 TIMES to prove idempotency
	for i := 1; i <= 3; i++ {
		if err := MigratePlanAccessUp("mysql"); err != nil {
			t.Fatalf("MigratePlanAccessUp run #%d failed: %v", i, err)
		}
	}

	// 3. Verify exactly 3 seeded plans exist
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM plans").Scan(&count); err != nil {
		t.Fatalf("failed querying plans count: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected exactly 3 plans after 3 runs, got %d", count)
	}

	// 4. Verify each seeded plan's attributes
	expected := map[string]int{
		"free":     0,
		"standard": 99,
		"premium":  199,
	}

	for id, expectedPrice := range expected {
		var price, movieLimit, epLimit, maxQuality, maxDevices int
		var razorpayPlanID string
		var isActive bool
		err := DB.QueryRow(
			"SELECT price_inr, daily_movie_limit, daily_episode_limit, max_quality, max_devices, razorpay_plan_id, is_active FROM plans WHERE id = ?",
			id,
		).Scan(&price, &movieLimit, &epLimit, &maxQuality, &maxDevices, &razorpayPlanID, &isActive)
		if err != nil {
			t.Fatalf("querying plan %s failed: %v", id, err)
		}
		if price != expectedPrice {
			t.Errorf("plan %s: expected price %d, got %d", id, expectedPrice, price)
		}
		if !isActive {
			t.Errorf("plan %s: expected is_active=true", id)
		}
	}

	// 5. Verify user_subscriptions indexes exist
	var rzpIdxCount, userStatusIdxCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions' AND INDEX_NAME = 'idx_sub_rzp_id'").Scan(&rzpIdxCount)
	_ = DB.QueryRow("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions' AND INDEX_NAME = 'idx_sub_user_status'").Scan(&userStatusIdxCount)

	if rzpIdxCount == 0 {
		t.Errorf("missing index idx_sub_rzp_id on user_subscriptions")
	}
	if userStatusIdxCount == 0 {
		t.Errorf("missing index idx_sub_user_status on user_subscriptions")
	}

	// 6. Verify titles.free_episodes column exists
	var freeEpColCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'titles' AND COLUMN_NAME = 'free_episodes'").Scan(&freeEpColCount)
	if freeEpColCount == 0 {
		t.Errorf("missing column free_episodes on titles table")
	}
}
