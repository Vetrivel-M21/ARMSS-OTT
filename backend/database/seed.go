package database

import (
	"log"
	"strings"
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

	// 2. Seed Full Tamil Catalog with sample video streams and metadata
	titles := []struct {
		ID           string
		Title        string
		Kind         string
		Year         int
		Maturity     string
		RuntimeMin   int
		MatchPercent int
		Logline      string
		Synopsis     string
		Poster       string
		Backdrop     string
		Trailer      string
		Tone         string
		Original     bool
		Kids         bool
		Tier         models.SubscriptionTier
		Genres       []string
		Badges       []string
	}{
		{
			ID:           "vikram",
			Title:        "Vikram",
			Kind:         "film",
			Year:         2022,
			Maturity:     "A",
			RuntimeMin:   174,
			MatchPercent: 99,
			Logline:      "A special agent is sent to investigate a series of masked killings and uncovers a drug cartel conspiracy.",
			Synopsis:     "Kamal Haasan stars as agent Vikram in Lokesh Kanagaraj's blockbuster action universe thriller.",
			Poster:       "/posters/vikram.jpg",
			Backdrop:     "/backdrops/vikram.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
			Tone:         "ember",
			Original:     true,
			Kids:         false,
			Tier:         models.TierPremium,
			Genres:       []string{"Action", "Thriller"},
			Badges:       []string{"4K UHD", "HDR10", "Dolby Atmos"},
		},
		{
			ID:           "master",
			Title:        "Master",
			Kind:         "film",
			Year:         2021,
			Maturity:     "A",
			RuntimeMin:   179,
			MatchPercent: 97,
			Logline:      "A college professor squares off against a ruthless gangster in a juvenile detention centre.",
			Synopsis:     "Thalapathy Vijay and Vijay Sethupathi in an explosive battle of wits and power.",
			Poster:       "/posters/master.jpg",
			Backdrop:     "/backdrops/master.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
			Tone:         "velvet",
			Original:     true,
			Kids:         false,
			Tier:         models.TierPremium,
			Genres:       []string{"Action", "Drama", "Thriller"},
			Badges:       []string{"4K UHD", "Dolby Vision"},
		},
		{
			ID:           "ponniyin-selvan-1",
			Title:        "Ponniyin Selvan: I",
			Kind:         "film",
			Year:         2022,
			Maturity:     "PG",
			RuntimeMin:   167,
			MatchPercent: 98,
			Logline:      "A warrior-spy races across the Chola empire to unmask a conspiracy threatening the royal throne.",
			Synopsis:     "Mani Ratnam's grand historical epic based on Kalki's timeless masterpiece.",
			Poster:       "/posters/ponniyin-selvan.jpg",
			Backdrop:     "/backdrops/ponniyin-selvan.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
			Tone:         "marble",
			Original:     true,
			Kids:         false,
			Tier:         models.TierStandard,
			Genres:       []string{"Historical", "Drama", "Epic"},
			Badges:       []string{"1080p HD", "5.1 Audio"},
		},
		{
			ID:           "soorarai-pottru",
			Title:        "Soorarai Pottru",
			Kind:         "film",
			Year:         2020,
			Maturity:     "PG",
			RuntimeMin:   153,
			MatchPercent: 97,
			Logline:      "A determined man from rural Tamil Nadu fights to bring affordable air travel to ordinary Indians.",
			Synopsis:     "Suriya stars in this National Award-winning drama inspired by Captain G.R. Gopinath's life.",
			Poster:       "/posters/soorarai-pottru.jpg",
			Backdrop:     "/backdrops/soorarai-pottru.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
			Tone:         "sky",
			Original:     false,
			Kids:         false,
			Tier:         models.TierFree,
			Genres:       []string{"Drama", "Biographical"},
			Badges:       []string{"HD", "CC"},
		},
		{
			ID:           "jai-bhim",
			Title:        "Jai Bhim",
			Kind:         "film",
			Year:         2021,
			Maturity:     "16+",
			RuntimeMin:   164,
			MatchPercent: 99,
			Logline:      "A fearless lawyer takes on the system to fight for an oppressed tribal woman seeking justice.",
			Synopsis:     "A powerful courtroom drama directed by T.J. Gnanavel starring Suriya as Advocate Chandru.",
			Poster:       "/posters/jai-bhim.jpg",
			Backdrop:     "/backdrops/jai-bhim.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Tone:         "signal",
			Original:     true,
			Kids:         false,
			Tier:         models.TierFree,
			Genres:       []string{"Legal Drama", "Social"},
			Badges:       []string{"HD", "CC"},
		},
		{
			ID:           "vettaiyan",
			Title:        "Vettaiyan",
			Kind:         "film",
			Year:         2024,
			Maturity:     "A",
			RuntimeMin:   170,
			MatchPercent: 95,
			Logline:      "A veteran police officer wages war against a broken judicial system to protect the innocent.",
			Synopsis:     "Superstar Rajinikanth and Fahadh Faasil in an intense police action drama.",
			Poster:       "/posters/vettaiyan.jpg",
			Backdrop:     "/backdrops/vettaiyan.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
			Tone:         "forest",
			Original:     true,
			Kids:         false,
			Tier:         models.TierPremium,
			Genres:       []string{"Action", "Thriller"},
			Badges:       []string{"4K UHD", "Dolby Atmos"},
		},
		{
			ID:           "jailer",
			Title:        "Jailer",
			Kind:         "film",
			Year:         2023,
			Maturity:     "A",
			RuntimeMin:   168,
			MatchPercent: 93,
			Logline:      "A retired jailer returns to action when his policeman son goes missing in a cartel investigation.",
			Synopsis:     "Superstar Rajinikanth as Tiger Muthuvel Pandian in Nelson's commercial blockbuster.",
			Poster:       "/posters/jailer.jpg",
			Backdrop:     "/backdrops/jailer.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
			Tone:         "ember",
			Original:     false,
			Kids:         false,
			Tier:         models.TierStandard,
			Genres:       []string{"Action", "Comedy"},
			Badges:       []string{"1080p HD"},
		},
		{
			ID:           "suzhal-vortex",
			Title:        "Suzhal – The Vortex",
			Kind:         "series",
			Year:         2022,
			Maturity:     "16+",
			RuntimeMin:   45,
			MatchPercent: 97,
			Logline:      "A young woman vanishes during a temple festival, unravelling a web of ancient village secrets.",
			Synopsis:     "Pushkar-Gayatri's landmark investigative thriller series starring Kathir and Aishwarya Rajesh.",
			Poster:       "/posters/suzhal.jpg",
			Backdrop:     "/backdrops/suzhal.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
			Tone:         "forest",
			Original:     true,
			Kids:         false,
			Tier:         models.TierPremium,
			Genres:       []string{"Crime", "Thriller", "Drama"},
			Badges:       []string{"4K UHD", "HDR"},
		},
		{
			ID:           "chutti-chutties",
			Title:        "Chutti Chutties",
			Kind:         "series",
			Year:         2024,
			Maturity:     "U",
			RuntimeMin:   22,
			MatchPercent: 96,
			Logline:      "Three mischievous kids in a Chennai apartment block solve neighbourhood mysteries together.",
			Synopsis:     "A delightful animated series celebrating curiosity and friendship, made for Tamil kids.",
			Poster:       "/posters/chutti.jpg",
			Backdrop:     "/backdrops/chutti.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Tone:         "sky",
			Original:     true,
			Kids:         true,
			Tier:         models.TierFree,
			Genres:       []string{"Family", "Comedy", "Animation"},
			Badges:       []string{"HD", "CC"},
		},
		{
			ID:           "leo",
			Title:        "Leo",
			Kind:         "film",
			Year:         2023,
			Maturity:     "A",
			RuntimeMin:   164,
			MatchPercent: 98,
			Logline:      "A quiet cafe owner in Himachal Pradesh is pursued by vicious gangsters who insist he is their estranged enforcer.",
			Synopsis:     "Thalapathy Vijay stars in Lokesh Kanagaraj's adrenaline-pumping LCU action spectacle.",
			Poster:       "/posters/leo.jpg",
			Backdrop:     "/backdrops/leo.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
			Tone:         "ember",
			Original:     false,
			Kids:         false,
			Tier:         models.TierPremium,
			Genres:       []string{"Action", "Thriller", "Crime"},
			Badges:       []string{"4K UHD", "Dolby Atmos"},
		},
		{
			ID:           "sarpatta-parambarai",
			Title:        "Sarpatta Parambarai",
			Kind:         "film",
			Year:         2021,
			Maturity:     "16+",
			RuntimeMin:   173,
			MatchPercent: 98,
			Logline:      "In 1970s North Madras, a young man fights against all odds to revive his clan's boxing glory.",
			Synopsis:     "Pa. Ranjith's gripping sports drama starring Arya as Kabilan.",
			Poster:       "/posters/sarpatta.jpg",
			Backdrop:     "/backdrops/sarpatta.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
			Tone:         "copper",
			Original:     false,
			Kids:         false,
			Tier:         models.TierStandard,
			Genres:       []string{"Sports", "Drama", "Period"},
			Badges:       []string{"1080p HD", "5.1 Audio"},
		},
		{
			ID:           "sun-tv-live",
			Title:        "Sun TV HD",
			Kind:         "live",
			Year:         2024,
			Maturity:     "U",
			RuntimeMin:   60,
			MatchPercent: 95,
			Logline:      "Tamil Nadu's premier entertainment channel streaming live 24/7.",
			Synopsis:     "Watch top Tamil serials, game shows, and special events live in crisp high definition.",
			Poster:       "/posters/sun-tv.jpg",
			Backdrop:     "/backdrops/sun-tv.jpg",
			Trailer:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Tone:         "live",
			Original:     false,
			Kids:         false,
			Tier:         models.TierStandard,
			Genres:       []string{"Live", "Entertainment", "News"},
			Badges:       []string{"LIVE", "1080p HD"},
		},
	}

	for _, t := range titles {
		var exists int
		_ = DB.QueryRow("SELECT COUNT(*) FROM titles WHERE id = ?", t.ID).Scan(&exists)
		if exists > 0 {
			// Update trailer if empty
			_, _ = DB.Exec("UPDATE titles SET trailer = ? WHERE id = ? AND (trailer IS NULL OR trailer = '')", t.Trailer, t.ID)
			continue
		}

		_, err := DB.Exec(
			`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, trailer, tone, original, kids, required_tier, genres, badges) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			t.ID, t.Title, t.Kind, t.Year, t.Maturity, t.RuntimeMin, t.MatchPercent, t.Logline, t.Synopsis, t.Poster, t.Backdrop, t.Trailer, t.Tone, t.Original, t.Kids, string(t.Tier), strings.Join(t.Genres, ","), strings.Join(t.Badges, ","),
		)
		if err != nil {
			log.Printf("[ARMSS-OTT] Error inserting title %s: %v", t.ID, err)
		}
	}

	seedUserActivityAndWatchProgress()

	log.Println("[ARMSS-OTT] Seed complete! Demo: free/standard/premium/admin @armss.com (Password: armss123)")
}

func seedUserActivityAndWatchProgress() {
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
		{"premium@armss.com", "vikram", 96.5, 9840, 1},
		{"premium@armss.com", "jailer", 100.0, 9600, 2},
		{"premium@armss.com", "leo", 75.0, 7200, 3},
		{"standard@armss.com", "vikram", 88.0, 8900, 1},
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
