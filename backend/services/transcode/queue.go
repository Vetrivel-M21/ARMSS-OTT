package transcode

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"armss-ott-backend/models"

	"github.com/hibiken/asynq"
)

// TaskTypeTranscodeVideo is the identifier for the video transcoding job.
const TaskTypeTranscodeVideo = "transcode_video"

var globalQueueClient *QueueClient

// QueueClient wraps the Asynq task queue client.
type QueueClient struct {
	client *asynq.Client
}

// InitQueueClient initializes the Asynq client connecting to Redis.
func InitQueueClient() (*QueueClient, error) {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	redisOpt := asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: redisPassword,
	}

	client := asynq.NewClient(redisOpt)
	qc := &QueueClient{client: client}
	globalQueueClient = qc
	log.Printf("[Asynq] Connected to Redis queue at %s", redisAddr)
	return qc, nil
}

// GetQueueClient returns global queue client instance.
func GetQueueClient() *QueueClient {
	return globalQueueClient
}

// EnqueueTranscodeVideo enqueues a video transcode task with 3 retries.
func (qc *QueueClient) EnqueueTranscodeVideo(videoID string) (*asynq.TaskInfo, error) {
	if qc == nil || qc.client == nil {
		return nil, fmt.Errorf("queue client is not initialized")
	}

	payload, err := json.Marshal(models.TranscodeJobPayload{VideoID: videoID})
	if err != nil {
		return nil, fmt.Errorf("marshalling transcode payload: %w", err)
	}

	task := asynq.NewTask(TaskTypeTranscodeVideo, payload)

	// Retry policy: 3 retries with exponential backoff, 2 hours timeout per attempt
	info, err := qc.client.Enqueue(
		task,
		asynq.MaxRetry(3),
		asynq.Timeout(2*time.Hour),
		asynq.Retention(24*time.Hour),
	)
	if err != nil {
		return nil, fmt.Errorf("enqueuing task in asynq: %w", err)
	}

	log.Printf("[Asynq] Enqueued transcode task ID: %s for video ID: %s (MaxRetry: 3)", info.ID, videoID)
	return info, nil
}

// Close closes the queue client.
func (qc *QueueClient) Close() error {
	if qc != nil && qc.client != nil {
		return qc.client.Close()
	}
	return nil
}
