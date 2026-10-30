package database

import (
	"fmt"
	"log"
	"strings"
)

func runPlanAccessMigrations(driver string) {
	if err := MigratePlanAccessUp(driver); err != nil {
		log.Printf("[PlanAccess Migration] Error running plan access migrations: %v", err)
	}
}

// MigratePlanAccessUp executes additive database migrations for plan-based access control.
func MigratePlanAccessUp(driver string) error {
	var schema string
	if driver == "mysql" {
		schema = `
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

		CREATE TABLE IF NOT EXISTS cashfree_webhook_events (
			event_id VARCHAR(128) PRIMARY KEY,
			event_type VARCHAR(64) NOT NULL,
			payload_json TEXT NOT NULL,
			processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
		`
	} else {
		schema = `
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
			is_active BOOLEAN NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		);

		CREATE TABLE IF NOT EXISTS user_subscriptions (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64) NOT NULL,
			plan_id VARCHAR(64) NOT NULL,
			razorpay_subscription_id VARCHAR(128) NOT NULL DEFAULT '',
			razorpay_customer_id VARCHAR(128) NOT NULL DEFAULT '',
			status VARCHAR(32) NOT NULL DEFAULT 'active',
			current_period_start DATETIME NOT NULL,
			current_period_end DATETIME NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (plan_id) REFERENCES plans(id)
		);

		CREATE TABLE IF NOT EXISTS daily_watch_records (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64) NOT NULL,
			watch_date VARCHAR(10) NOT NULL,
			content_id VARCHAR(100) NOT NULL,
			content_type VARCHAR(20) NOT NULL,
			first_started_at DATETIME NOT NULL,
			UNIQUE(user_id, watch_date, content_id),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
			event_id VARCHAR(128) PRIMARY KEY,
			event_type VARCHAR(64) NOT NULL,
			payload_json TEXT NOT NULL,
			processed_at DATETIME NOT NULL
		);

		CREATE TABLE IF NOT EXISTS cashfree_webhook_events (
			event_id VARCHAR(128) PRIMARY KEY,
			event_type VARCHAR(64) NOT NULL,
			payload_json TEXT NOT NULL,
			processed_at DATETIME NOT NULL
		);
		`
	}

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

	if driver == "mysql" {
		addColumnIfNotExists(DB, "titles", "free_episodes", "INT NOT NULL DEFAULT 0")
		addColumnIfNotExists(DB, "user_subscriptions", "cashfree_order_id", "VARCHAR(128) NOT NULL DEFAULT ''")
	}

	// Seed default baseline plans (idempotent)
	if err := seedDefaultPlans(driver); err != nil {
		log.Printf("[PlanAccess Migration] Warning seeding default plans: %v", err)
	}

	log.Printf("[PlanAccess Migration] ✓ Plan-based access schema verified successfully (%s)", driver)
	return nil
}

func seedDefaultPlans(driver string) error {
	var seedQuery string
	if driver == "mysql" {
		seedQuery = `
		INSERT IGNORE INTO plans 
			(id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, max_quality, max_devices, razorpay_plan_id, is_active, created_at, updated_at)
		VALUES 
			('free', 'Free Member', 0, 'monthly', 1, 2, 720, 1, '', TRUE, NOW(), NOW()),
			('standard', 'Standard Full HD', 99, 'monthly', 5, 10, 1080, 2, '', TRUE, NOW(), NOW()),
			('premium', 'Premium VIP 4K', 199, 'monthly', 999, 999, 2160, 4, '', TRUE, NOW(), NOW());`
	} else {
		seedQuery = `
		INSERT OR IGNORE INTO plans 
			(id, name, price_inr, billing_period, daily_movie_limit, daily_episode_limit, max_quality, max_devices, razorpay_plan_id, is_active, created_at, updated_at)
		VALUES 
			('free', 'Free Member', 0, 'monthly', 1, 2, 720, 1, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
			('standard', 'Standard Full HD', 99, 'monthly', 5, 10, 1080, 2, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
			('premium', 'Premium VIP 4K', 199, 'monthly', 999, 999, 2160, 4, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
	}
	_, err := DB.Exec(seedQuery)
	return err
}
