package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"armss-ott-backend/database"
	"armss-ott-backend/handlers"
	"armss-ott-backend/middleware"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file (silent — does not fail if file is missing)
	_ = godotenv.Load()

	log.Println("==================================================")
	log.Println("     ARMSS-OTT High-Performance Go Backend       ")
	log.Println("==================================================")

	// 1. Initialize Database (MySQL with auto SQLite fallback)
	db, err := database.InitDB()
	if err != nil {
		log.Fatalf("[FATAL] Database initialization failed: %v", err)
	}
	defer db.Close()

	// 2. Seed Database with Demo Accounts and Content
	database.SeedDatabase()

	// 3. Router Setup
	r := chi.NewRouter()

	// Global Middleware
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// Cross-Origin Resource Sharing (CORS)
	allowedOrigins := []string{"http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:*", "http://127.0.0.1:*"}
	if custom := os.Getenv("ALLOWED_ORIGINS"); custom != "" {
		for _, o := range strings.Split(custom, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// 4. API Routes
	r.Route("/api", func(r chi.Router) {
		// Health check
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"healthy","service":"armss-ott-backend","driver":"` + database.DriverName + `"}`))
		})

		// Public Auth
		r.Post("/auth/register", handlers.Register)
		r.Post("/auth/login", handlers.Login)
		r.Post("/auth/google", handlers.GoogleAuth)
		r.Post("/auth/forgot-password/request", handlers.ForgotPasswordRequest)
		r.Post("/auth/forgot-password/reset", handlers.ForgotPasswordReset)

		// Public Subscription Plans
		r.Get("/subscription/plans", handlers.GetPlans)

		// Public Catalog
		r.Get("/titles", handlers.ListTitles)
		r.Get("/titles/{id}", handlers.GetTitle)

		// Optional Auth Playback Ticket (Checks Tier Entitlement)
		r.With(middleware.OptionalAuth).Post("/titles/{id}/playback-ticket", handlers.CheckPlaybackTicket)

		// Protected Routes (Require Bearer Token)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth)

			// Current User info
			r.Get("/auth/me", handlers.Me)

			// Subscription actions
			r.Post("/subscription/upgrade", handlers.UpgradeSubscription)
			r.Post("/subscription/cancel", handlers.CancelSubscription)

			// Cloud Sync
			r.Get("/watchlist", handlers.GetWatchlist)
			r.Post("/watchlist/toggle", handlers.ToggleWatchlist)

			r.Get("/progress", handlers.GetProgress)
			r.Post("/progress/heartbeat", handlers.HeartbeatProgress)

			// Watch History
			r.Get("/history", handlers.GetHistory)
			r.Delete("/history/{id}", handlers.DeleteHistoryItem)
			r.Delete("/history", handlers.ClearHistory)

			r.Post("/ratings", handlers.SetRating)
		})

		// Admin Routes (Require Bearer Token + Admin Role)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth)
			r.Use(middleware.RequireAdmin)
			r.Get("/admin/users", handlers.AdminListUsers)
			r.Get("/admin/users/{id}/details", handlers.AdminGetUserDetail)
			r.Put("/admin/users/{id}/subscription", handlers.AdminUpdateUserSubscription)
			r.Put("/admin/users/{id}/ban", handlers.AdminBanUser)
			r.Delete("/admin/users/{id}", handlers.AdminDeleteUser)
			r.Get("/admin/titles", handlers.AdminListTitles)
			r.Get("/admin/titles/{id}", handlers.AdminGetTitle)
			r.Post("/admin/titles", handlers.AdminCreateTitle)
			r.Put("/admin/titles/{id}", handlers.AdminUpdateTitle)
			r.Delete("/admin/titles/{id}", handlers.AdminDeleteTitle)
			r.Get("/admin/analytics", handlers.AdminGetAnalyticsOverview)
			r.Get("/admin/analytics/overview", handlers.AdminGetAnalyticsOverview)
			r.Get("/admin/analytics/daily-trends", handlers.AdminGetDailyTrends)
			r.Get("/admin/analytics/top-titles", handlers.AdminGetTopWatchedTitles)
			r.Get("/admin/analytics/users", handlers.AdminGetUserAnalytics)
			r.Post("/admin/notifications", handlers.AdminBroadcast)
			r.Post("/admin/upload", handlers.AdminUpload)
			r.Put("/admin/settings/layout", handlers.AdminUpdateLayoutSettings)
			r.Delete("/admin/settings/layout", handlers.AdminResetLayoutSettings)
		})
		// Public notification endpoint (to show admin broadcast to all users)
		r.Get("/notifications/latest", handlers.GetNotification)

		// Public Layout Settings
		r.Get("/settings/layout", handlers.GetLayoutSettings)
	})

	// 5. Static File Serving for Uploads (images and videos)
	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = filepath.Join("..", "frontend", "public", "uploads")
		if _, err := os.Stat(uploadsDir); err != nil {
			uploadsDir = filepath.Join("..", "public", "uploads")
			if _, err := os.Stat(uploadsDir); err != nil {
				uploadsDir = filepath.Join("public", "uploads")
			}
		}
	}
	_ = os.MkdirAll(uploadsDir, 0755)
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("[ARMSS-OTT] Server listening on http://0.0.0.0:%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("[FATAL] Server terminated: %v", err)
	}
}

