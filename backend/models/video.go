package models

import (
	"time"
)

// Video status constants
const (
	VideoStatusUploaded   = "uploaded"
	VideoStatusProcessing = "processing"
	VideoStatusReady      = "ready"
	VideoStatusFailed     = "failed"
)

// Video represents a video record in the ingest & transcoding pipeline.
type Video struct {
	ID           string    `json:"id" db:"id"`
	Title        string    `json:"title" db:"title"`
	Status       string    `json:"status" db:"status"`
	MasterKey    string    `json:"master_key" db:"master_key"`
	Duration     float64   `json:"duration" db:"duration"`
	ErrorMessage *string   `json:"error_message,omitempty" db:"error_message"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// CreateVideoRequest represents payload for creating a new video entry.
type CreateVideoRequest struct {
	Title string `json:"title"`
}

// CreateVideoResponse represents the response containing presigned master upload URL.
type CreateVideoResponse struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	MasterKey string    `json:"master_key"`
	UploadURL string    `json:"upload_url"`
	CreatedAt time.Time `json:"created_at"`
}

// TranscodeJobPayload is the Asynq task payload for transcode_video.
type TranscodeJobPayload struct {
	VideoID string `json:"video_id"`
}
