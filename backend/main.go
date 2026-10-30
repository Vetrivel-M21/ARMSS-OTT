package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/handlers"
	"armss-ott-backend/middleware"
	"armss-ott-backend/services/metrics"
	"armss-ott-backend/services/storage"
	"armss-ott-backend/services/transcode"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// 0. Native Healthcheck Flag (used by Docker healthcheck with zero external dependencies)
	for _, arg := range os.Args[1:] {
		if arg == "-healthcheck" || arg == "--healthcheck" {
			port := os.Getenv("PORT")
			if port == "" {
				port = "8090"
			}
			client := &http.Client{Timeout: 3 * time.Second}
			resp, err := client.Get("http://127.0.0.1:" + port + "/health")
			if err != nil || resp.StatusCode != http.StatusOK {
				os.Exit(1)
			}
			os.Exit(0)
		}
	}

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

	// 2.5 Initialize S3 Storage and Asynq Task Queue
	storageSvc, storageErr := storage.InitFromEnv()
	if storageErr != nil {
		log.Printf("[Storage] Warning: Failed to initialize S3 storage: %v", storageErr)
	} else {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := storageSvc.EnsureBuckets(ctx); err != nil {
				log.Printf("[Storage] Warning: EnsureBuckets error: %v", err)
			}
		}()
	}

	queueClient, queueErr := transcode.InitQueueClient()
	if queueErr != nil {
		log.Printf("[Asynq] Warning: Failed to connect to Redis queue: %v", queueErr)
	} else {
		defer queueClient.Close()
	}

	// Start transcoding worker if enabled (default true)
	if os.Getenv("ENABLE_WORKER") != "false" && storageSvc != nil {
		worker, workerErr := transcode.StartWorker(storageSvc, db)
		if workerErr != nil {
			log.Printf("[Worker] Warning: Failed to start transcode worker: %v", workerErr)
		} else {
			defer worker.Stop()
		}
	}

	if os.Getenv("RUN_AS_WORKER_ONLY") == "true" {
		log.Println("[Worker] Running in dedicated Transcode Worker mode. Awaiting jobs from Redis...")
		select {}
	}

	// 3. Router Setup
	r := chi.NewRouter()

	// Global Middleware
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// Cross-Origin Resource Sharing (CORS) — allow localhost, LAN IPs, and mobile devices
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"*"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Top-level Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"healthy","service":"armss-ott-backend"}`))
	})

	// 4. API Routes
	r.Route("/api", func(r chi.Router) {
		// Root API Status
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"online","service":"armss-ott-backend","version":"1.0.0"}`))
		})

		// Health & Metrics
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"healthy","service":"armss-ott-backend","driver":"` + database.DriverName + `"}`))
		})
		r.Get("/metrics", metrics.Handler)

		// Public Auth
		r.Post("/auth/register", handlers.Register)
		r.Post("/auth/register/send-otp", handlers.RegisterSendOTP)
		r.Post("/auth/register/verify-otp", handlers.RegisterVerifyOTP)
		r.Post("/auth/login", handlers.Login)
		r.Post("/auth/google", handlers.GoogleAuth)
		r.Post("/auth/forgot-password", handlers.ForgotPasswordRequest)
		r.Post("/auth/forgot-password/request", handlers.ForgotPasswordRequest)
		r.Post("/auth/reset-password", handlers.ForgotPasswordReset)
		r.Post("/auth/forgot-password/reset", handlers.ForgotPasswordReset)

		// Public Profiles & Fallback
		r.With(middleware.OptionalAuth).Get("/profiles", handlers.GetProfiles)

		// Public Broadcast Notifications
		r.Get("/notifications/latest", handlers.GetNotification)

		// Public Subscription Plans & Payment Webhooks
		r.Get("/subscription/plans", handlers.GetPlans)
		r.Get("/plans", handlers.PublicListPlans)
		r.Post("/webhooks/razorpay", handlers.HandleRazorpayWebhook)
		r.Post("/webhooks/cashfree", handlers.HandleCashfreeWebhook)

		// Public Catalog
		r.Get("/titles", handlers.ListTitles)
		r.Get("/titles/{id}", handlers.GetTitle)
		r.Get("/titles/{id}/episodes", handlers.PublicListEpisodes)

		// Optional Auth Playback Ticket (Checks Tier Entitlement)
		r.With(middleware.OptionalAuth).Post("/titles/{id}/playback-ticket", handlers.CheckPlaybackTicket)

		// Protected Routes (Require Bearer Token)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth)

			// Current User info
			r.Get("/auth/me", handlers.Me)

			// Profiles Management
			r.Post("/profiles", handlers.CreateProfile)
			r.Put("/profiles/{id}", handlers.UpdateProfile)
			r.Delete("/profiles/{id}", handlers.DeleteProfile)

			// Subscription actions
			r.Post("/subscription/upgrade", handlers.UpgradeSubscription)
			r.Post("/subscription/checkout", handlers.CreateSubscriptionCheckout)
			r.Post("/subscription/verify", handlers.VerifySubscriptionPayment)
			r.Post("/subscription/cancel", handlers.CancelSubscription)

			// Cloud Sync
			r.Get("/watchlist", handlers.GetWatchlist)
			r.Post("/watchlist/toggle", handlers.ToggleWatchlist)
			r.Get("/my-list", handlers.GetWatchlist)
			r.Post("/my-list/toggle", handlers.ToggleWatchlist)

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
			r.Get("/admin/titles/{id}/episodes", handlers.AdminListEpisodes)
			r.Post("/admin/titles/{id}/episodes", handlers.AdminCreateEpisode)
			r.Put("/admin/episodes/{episodeId}", handlers.AdminUpdateEpisode)
			r.Delete("/admin/episodes/{episodeId}", handlers.AdminDeleteEpisode)
			r.Get("/admin/analytics", handlers.AdminGetAnalyticsOverview)
			r.Get("/admin/analytics/overview", handlers.AdminGetAnalyticsOverview)
			r.Get("/admin/analytics/daily-trends", handlers.AdminGetDailyTrends)
			r.Get("/admin/analytics/top-titles", handlers.AdminGetTopWatchedTitles)
			r.Get("/admin/analytics/users", handlers.AdminGetUserAnalytics)
			r.Get("/admin/notifications", handlers.GetNotification)
			r.Post("/admin/notifications", handlers.AdminBroadcast)
			r.Delete("/admin/notifications", handlers.AdminClearBroadcast)
			r.Post("/admin/upload", handlers.AdminUpload)
			r.Put("/admin/settings/layout", handlers.AdminUpdateLayoutSettings)
			r.Delete("/admin/settings/layout", handlers.AdminResetLayoutSettings)

			// Plan-based Access Control Management
			r.Get("/admin/plans", handlers.AdminListPlans)
			r.Put("/admin/plans/{id}", handlers.AdminUpdatePlan)
			r.Get("/admin/titles/{id}/access", handlers.AdminGetTitleAccess)
			r.Put("/admin/titles/{id}/access", handlers.AdminUpdateTitleAccess)

			// Video Ingest & Transcoding Pipeline
			r.Post("/admin/videos", handlers.AdminCreateVideo)
			r.Post("/admin/videos/{id}/complete", handlers.AdminCompleteVideoUpload)
			r.Get("/admin/videos", handlers.AdminListVideos)
			r.Get("/admin/videos/{id}", handlers.AdminGetVideo)
		})

		// Direct access fallback for video endpoints (e.g. testing / integration)
		r.Post("/videos", handlers.AdminCreateVideo)
		r.Post("/videos/{id}/complete", handlers.AdminCompleteVideoUpload)
		r.Get("/videos", handlers.AdminListVideos)
		r.Get("/videos/{id}", handlers.AdminGetVideo)

		// Playback API
		r.With(middleware.RequireAuth).Get("/videos/{id}/playback", handlers.GetPlaybackTicket)
		r.Get("/videos/{id}/master.m3u8", handlers.GetMasterPlaylist)
		r.Get("/videos/{id}/{rendition}.m3u8", handlers.GetRenditionPlaylist)
		r.Get("/videos/{id}/stream_{num}.m3u8", handlers.GetRenditionPlaylist)
		r.Get("/videos/{id}/{rendition}/index.m3u8", handlers.GetRenditionPlaylist)
		r.With(middleware.RequireAuth).Post("/videos/{id}/progress", handlers.SaveWatchProgress)
		r.With(middleware.RequireAuth).Post("/videos/{id}/heartbeat", handlers.SendStreamHeartbeat)
		r.Get("/videos/{id}/key", handlers.GetHLSKey)

		// Public notification endpoint (to show admin broadcast to all users)
		r.Get("/notifications/latest", handlers.GetNotification)

		// Public Layout Settings
		r.Get("/settings/layout", handlers.GetLayoutSettings)
	})

	// Ingest Pipeline root routes (for direct POST /admin/videos calls)
	r.Post("/admin/videos", handlers.AdminCreateVideo)
	r.Post("/admin/videos/{id}/complete", handlers.AdminCompleteVideoUpload)
	r.Get("/admin/videos", handlers.AdminListVideos)
	r.Get("/admin/videos/{id}", handlers.AdminGetVideo)

	// Playback API root routes (for direct /videos/:id/... calls)
	r.With(middleware.RequireAuth).Get("/videos/{id}/playback", handlers.GetPlaybackTicket)
	r.Get("/videos/{id}/master.m3u8", handlers.GetMasterPlaylist)
	r.Get("/videos/{id}/{rendition}.m3u8", handlers.GetRenditionPlaylist)
	r.Get("/videos/{id}/stream_{num}.m3u8", handlers.GetRenditionPlaylist)
	r.Get("/videos/{id}/{rendition}/index.m3u8", handlers.GetRenditionPlaylist)
	r.With(middleware.RequireAuth).Post("/videos/{id}/progress", handlers.SaveWatchProgress)
	r.With(middleware.RequireAuth).Post("/videos/{id}/heartbeat", handlers.SendStreamHeartbeat)
	r.Get("/videos/{id}/key", handlers.GetHLSKey)
	r.Get("/metrics", metrics.Handler)


	// 5. Static File Serving for Uploads, Posters, Backdrops, and Trailers
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

	frontendPublic := filepath.Join("..", "frontend", "public")
	if _, err := os.Stat(frontendPublic); err == nil {
		r.Handle("/posters/*", http.StripPrefix("/posters/", http.FileServer(http.Dir(filepath.Join(frontendPublic, "posters")))))
		r.Handle("/backdrops/*", http.StripPrefix("/backdrops/", http.FileServer(http.Dir(filepath.Join(frontendPublic, "backdrops")))))
		r.Handle("/trailers/*", http.StripPrefix("/trailers/", http.FileServer(http.Dir(filepath.Join(frontendPublic, "trailers")))))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("[ARMSS-OTT] Server listening on http://0.0.0.0:%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("[FATAL] Server terminated: %v", err)
	}
}

