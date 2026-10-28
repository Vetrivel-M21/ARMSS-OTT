package database

import (
	"log"
	"time"

	"armss-ott-backend/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func SeedDatabase() {
	var userCount int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	if err == nil && userCount > 0 {
		log.Println("[ARMSS-OTT] Database already contains users, verifying admin & catalog seed...")
	} else {
		log.Println("[ARMSS-OTT] Seeding initial demo users...")

		// 1. Seed Demo Users
		now := time.Now()

		demoUsers := []struct {
			Email    string
			Name     string
			Password string
			Tier     models.SubscriptionTier
		}{
			{"admin@armss.com", "ARMSS Admin", "admin123", models.TierPremium},
			{"sarah@techstream.com", "Sarah Jenkins", "sarah123", models.TierPremium},
			{"marcus@filmlover.org", "Marcus Vance", "marcus123", models.TierStandard},
			{"demo@armss.com", "Demo Viewer", "demo123", models.TierFree},
			{"free@armss.com", "Free Member", "armss123", models.TierFree},
			{"standard@armss.com", "Standard Member", "armss123", models.TierStandard},
			{"premium@armss.com", "Premium VIP Member", "armss123", models.TierPremium},
		}

		for _, u := range demoUsers {
			userPass := u.Password
			if userPass == "" {
				userPass = "armss123"
			}
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(userPass), bcrypt.DefaultCost)
			userID := uuid.New().String()
			isAdmin := u.Email == "admin@armss.com"
			_, err := DB.Exec(
				"INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				userID, u.Email, string(hashedPassword), u.Name, string(u.Tier), isAdmin, now, now,
			)
			if err != nil {
				log.Printf("[ARMSS-OTT] User %s exists or seed error: %v", u.Email, err)
				continue
			}

			// Create default profiles: Adult & Kids
			miraProfileID := uuid.New().String()
			kidsProfileID := uuid.New().String()

			_, _ = DB.Exec(
				"INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				miraProfileID, userID, "Mira", "marble", false, "", now,
			)
			_, _ = DB.Exec(
				"INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, pin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
				kidsProfileID, userID, "Kids", "moss", true, "1234", now,
			)
		}
	}

	// Ensure Admin User Exists with documented credentials
	var adminExists int
	now := time.Now()
	_ = DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", "admin@armss.com").Scan(&adminExists)
	if adminExists == 0 {
		adminID := uuid.New().String()
		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		_, _ = DB.Exec(
			"INSERT INTO users (id, email, password_hash, name, subscription_tier, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			adminID, "admin@armss.com", string(adminHash), "ARMSS Admin", string(models.TierPremium), true, now, now,
		)
		log.Println("[ARMSS-OTT] Admin user seeded: admin@armss.com (Password: admin123)")
	} else {
		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		_, _ = DB.Exec("UPDATE users SET password_hash = ?, is_admin = true WHERE email = ?", string(adminHash), "admin@armss.com")
	}

	// Titles are managed entirely by administrators via the Admin dashboard.
	// No demo titles (vikram, master) are pre-seeded to prevent recreating deleted items on restart.

	log.Println("[ARMSS-OTT] Seed complete! Demo: free/standard/premium/admin @armss.com (Password: armss123)")
}

func seedUserActivityAndWatchProgress() {
	// Sample watch progress is only seeded if real titles exist in database
	var titleCount int
	_ = DB.QueryRow("SELECT COUNT(*) FROM titles").Scan(&titleCount)
	if titleCount == 0 {
		return
	}

	var count int
	_ = DB.QueryRow("SELECT COUNT(*) FROM watch_progress").Scan(&count)
	if count > 0 {
		return
	}

	log.Println("[ARMSS-OTT] Seeding initial watch progress & user activity analytics...")
	now := time.Now()

	// Fetch demo user IDs
	rows, err := DB.Query("SELECT id, email FROM users")
	if err != nil {
		return
	}
	defer rows.Close()

	userMap := make(map[string]string)
	for rows.Next() {
		var id, email string
		if scanErr := rows.Scan(&id, &email); scanErr == nil {
			userMap[email] = id
		}
	}

	type sampleWatch struct {
		email    string
		titleID  string
		percent  float64
		seconds  float64
		daysAgo  int
	}

	samples := []sampleWatch{
		{"premium@armss.com", "jailer", 100.0, 9600, 2},
		{"premium@armss.com", "leo", 75.0, 7200, 3},
		{"standard@armss.com", "sarpatta", 92.5, 9600, 4},
		{"standard@armss.com", "suzhal", 65.0, 4800, 5},
		{"free@armss.com", "sun-tv-live", 100.0, 3600, 0},
		{"admin@armss.com", "jailer", 100.0, 9600, 0},
		{"admin@armss.com", "leo", 94.0, 9020, 1},
	}

	for _, s := range samples {
		uID, ok := userMap[s.email]
		if !ok {
			continue
		}
		var exists int
		_ = DB.QueryRow("SELECT COUNT(*) FROM titles WHERE id = ?", s.titleID).Scan(&exists)
		if exists == 0 {
			continue
		}
		updatedAt := now.AddDate(0, 0, -s.daysAgo)
		_, _ = DB.Exec(
			"INSERT INTO watch_progress (user_id, profile_id, title_id, progress_percent, time_seconds, updated_at) VALUES (?, 'default', ?, ?, ?, ?)",
			uID, s.titleID, s.percent, s.seconds, updatedAt,
		)
		_, _ = DB.Exec(
			"UPDATE users SET last_active_at = ?, last_login_at = ? WHERE id = ?",
			updatedAt, updatedAt, uID,
		)
	}

	// Seed activity logs across past 14 days
	for daysAgo := 13; daysAgo >= 0; daysAgo-- {
		logTime := now.AddDate(0, 0, -daysAgo)
		for email, uID := range userMap {
			if daysAgo%2 == 0 || email == "admin@armss.com" || email == "premium@armss.com" {
				_, _ = DB.Exec(
					"INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'login', 'Daily login', ?)",
					uuid.New().String(), uID, logTime,
				)
				_, _ = DB.Exec(
					"INSERT INTO user_activity_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'watch', 'Stream session', ?)",
					uuid.New().String(), uID, logTime.Add(15*time.Minute),
				)
			}
		}
	}
}
