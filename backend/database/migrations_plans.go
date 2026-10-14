package database

import (
	"fmt"
	"log"
	"strings"
)

// MigratePlanAccessUp executes additive MySQL-only database migrations for plan-based access control.
func MigratePlanAccessUp(driver string) error {
	if driver != "mysql" {
		// Plan access feature is MySQL-only; no-op for non-MySQL drivers.
		return nil
	}

	schema := `
	CREATE TABLE IF NOT EXISTS plans (
		id VARCHAR(64) PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		price_inr INT NOT NULL DEFAULT 0,
		billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
		daily_movie_limit INT NOT NULL DEFAULT 1,
		daily_episode_limit INT NOT NULL DEFAULT 2,
		max_quality INT NOT NULL DEFAULT 720,
		max_devices INT NOT NULL DEFAULT 1,
		razorpay_plan_id VARCHAR(128) NOT NULL DEFAULT '',
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

	CREATE TABLE IF NOT EXISTS user_subscriptions (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		plan_id VARCHAR(64) NOT NULL,
		razorpay_subscription_id VARCHAR(128) NOT NULL DEFAULT '',
		razorpay_customer_id VARCHAR(128) NOT NULL DEFAULT '',
		status VARCHAR(32) NOT NULL DEFAULT 'active',
		current_period_start DATETIME NOT NULL,
		current_period_end DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_sub_rzp_id (razorpay_subscription_id),
		KEY idx_sub_user_status (user_id, status),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (plan_id) REFERENCES plans(id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

	CREATE TABLE IF NOT EXISTS daily_watch_records (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		watch_date VARCHAR(10) NOT NULL,
		content_id VARCHAR(100) NOT NULL,
		content_type VARCHAR(20) NOT NULL,
		first_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		UNIQUE KEY uq_user_date_content (user_id, watch_date, content_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

	CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
		event_id VARCHAR(128) PRIMARY KEY,
		event_type VARCHAR(64) NOT NULL,
		payload_json TEXT NOT NULL,
		processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
	`

	queries := strings.Split(schema, ";")
	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("creating plan access table: %w", err)
		}
	}

	// Additive column on titles table (free_episodes only; required_tier = 'free' designates free titles)
	addColumnIfNotExists(DB, "titles", "free_episodes", "INT NOT NULL DEFAULT 0")

	// Seed default baseline plans (idempotent with INSERT IGNORE and NOW())
	if err := seedDefaultPlansMySQL(); err != nil {
		log.Printf("[PlanAccess Migration] Warning seeding default plans: %v", err)
	}

	log.Printf("[PlanAccess Migration] ✓ Plan-based access MySQL schema verified successfully")
	return nil
}

// MigratePlanAccessDown provides the down migration to roll back plan access schema.
//
// WARNING: DEVELOPMENT ONLY.
// DO NOT EXECUTE IN PRODUCTION: Running this destroys all user subscriptions, payment
// linkages, and daily watch tracking history after go-live.
func MigratePlanAccessDown(driver string) error {
	if driver != "mysql" {
		return nil
	}

	downQueries := []string{
		"DROP TABLE IF EXISTS razorpay_webhook_events",
		"DROP TABLE IF EXISTS daily_watch_records",
		"DROP TABLE IF EXISTS user_subscriptions",
		"DROP TABLE IF EXISTS plans",
	}

	for _, q := range downQueries {
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("executing down query %q: %w", q, err)
		}
	}

	log.Println("[PlanAccess Migration] ✓ Plan access tables dropped successfully (DOWN migration executed - DEV ONLY)")
	return nil
}

func runPlanAccessMigrations(driver string) {
	if driver != "mysql" {
		return
	}
	if err := MigratePlanAccessUp(driver); err != nil {
		log.Printf("[PlanAccess Migration] Error running plan access migrations: %v", err)
	}
}

func seedDefaultPlansMySQL() error {
	seedQuery := `
	INSERT IGNORE INTO plans 
		(id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, max_quality, max_devices, razorpay_plan_id, is_active, created_at, updated_at)
	VALUES 
		('free', 'Free Member', 0, 'monthly', 1, 2, 720, 1, '', TRUE, NOW(), NOW()),
		('standard', 'Standard Full HD', 99, 'monthly', 5, 10, 1080, 2, '', TRUE, NOW(), NOW()),
		('premium', 'Premium VIP 4K', 199, 'monthly', 999, 999, 2160, 4, '', TRUE, NOW(), NOW());
	`
	_, err := DB.Exec(seedQuery)
	return err
}
