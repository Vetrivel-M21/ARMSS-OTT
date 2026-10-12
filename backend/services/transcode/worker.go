package transcode

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"armss-ott-backend/services/storage"

	"github.com/hibiken/asynq"
)

// Server wraps the Asynq Server for handling transcode jobs.
type Server struct {
	srv *asynq.Server
}

// StartWorker initializes and starts an Asynq worker server.
func StartWorker(storageSvc *storage.Service, db *sql.DB) (*Server, error) {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	concurrencyStr := os.Getenv("TRANSCODE_CONCURRENCY")
	concurrency := 2
	if c, err := strconv.Atoi(concurrencyStr); err == nil && c > 0 {
		concurrency = c
	}

	redisOpt := asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: redisPassword,
	}

	srv := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Concurrency: concurrency,
			Queues: map[string]int{
				"default": 1,
			},
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				log.Printf("[Asynq Worker Error] Task %s failed: %v", task.Type(), err)
			}),
			RetryDelayFunc: func(n int, e error, t *asynq.Task) time.Duration {
				// Exponential backoff: 10s, 30s, 60s
				switch n {
				case 1:
					return 10 * time.Second
				case 2:
					return 30 * time.Second
				default:
					return 60 * time.Second
				}
			},
		},
	)

	mux := asynq.NewServeMux()
	handler := NewTranscodeHandler(storageSvc, db)
	mux.HandleFunc(TaskTypeTranscodeVideo, handler.ProcessTask)

	log.Printf("[Asynq] Starting transcoding worker (concurrency: %d, Redis: %s)...", concurrency, redisAddr)

	go func() {
		if err := srv.Run(mux); err != nil {
			log.Printf("[Asynq Worker] Server stopped: %v", err)
		}
	}()

	return &Server{srv: srv}, nil
}

// Stop gracefully shuts down the worker server.
func (s *Server) Stop() {
	if s != nil && s.srv != nil {
		s.srv.Shutdown()
	}
}
