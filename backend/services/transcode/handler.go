package transcode

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/models"
	"armss-ott-backend/services/metrics"
	"armss-ott-backend/services/storage"

	"github.com/hibiken/asynq"
)

// TranscodeHandler executes FFmpeg transcoding for queued videos.
type TranscodeHandler struct {
	storage *storage.Service
	db      *sql.DB
}

// NewTranscodeHandler creates a new TranscodeHandler.
func NewTranscodeHandler(storageSvc *storage.Service, db *sql.DB) *TranscodeHandler {
	return &TranscodeHandler{
		storage: storageSvc,
		db:      db,
	}
}

// ProcessTask handles the "transcode_video" Asynq task.
func (h *TranscodeHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload models.TranscodeJobPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshalling task payload: %w", asynq.SkipRetry)
	}

	videoID := payload.VideoID
	jobStartTime := time.Now()
	log.Printf("[Transcoder] ▶ Starting transcoding job for Video ID: %s", videoID)

	// Fetch video record from DB
	var video models.Video
	query := "SELECT id, title, status, master_key, duration, created_at, updated_at FROM videos WHERE id = ?"
	err := h.db.QueryRowContext(ctx, query, videoID).Scan(
		&video.ID, &video.Title, &video.Status, &video.MasterKey, &video.Duration, &video.CreatedAt, &video.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("[Transcoder] Video ID %s not found in DB. Skipping retry.", videoID)
			return fmt.Errorf("video not found: %w", asynq.SkipRetry)
		}
		return fmt.Errorf("querying video: %w", err)
	}

	// Update status to 'processing'
	if err := h.updateVideoStatus(ctx, videoID, models.VideoStatusProcessing, nil, 0); err != nil {
		log.Printf("[Transcoder] Warning: Failed to update status to processing: %v", err)
	}

	// Create temporary working directory for scratch files
	scratchDir := filepath.Join(os.TempDir(), "armss_transcode", videoID)
	_ = os.RemoveAll(scratchDir)
	if err := os.MkdirAll(scratchDir, 0755); err != nil {
		errMsg := fmt.Sprintf("failed to create scratch directory: %v", err)
		metrics.RecordTranscodeDuration(time.Since(jobStartTime), false, errMsg)
		log.Printf("[Transcoder METRIC] Video ID: %s | Status: FAILED | Duration: %v | Error: %s", videoID, time.Since(jobStartTime), errMsg)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}
	defer func() {
		// Clean up scratch directory on finish
		_ = os.RemoveAll(scratchDir)
	}()

	// 1. Download master video from S3
	masterLocalPath := filepath.Join(scratchDir, "master.mp4")
	log.Printf("[Transcoder] Downloading master %s from bucket %s to %s...", video.MasterKey, h.storage.MastersBucket(), masterLocalPath)
	if err := h.storage.DownloadFile(ctx, h.storage.MastersBucket(), video.MasterKey, masterLocalPath); err != nil {
		errMsg := fmt.Sprintf("downloading master file from S3: %v", err)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}

	// 2. Probe video metadata using ffprobe
	log.Printf("[Transcoder] Probing video file with ffprobe...")
	meta, err := ProbeVideo(ctx, masterLocalPath)
	if err != nil {
		errMsg := fmt.Sprintf("probing video file: %v", err)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}
	log.Printf("[Transcoder] Probed metadata: %dx%d, Duration: %.2fs, FPS: %.2f", meta.Width, meta.Height, meta.Duration, meta.FPS)

	// 3. Filter ladder to skip any rung exceeding source resolution
	rungs := FilterLadder(meta)
	var rungNames []string
	for _, r := range rungs {
		rungNames = append(rungNames, fmt.Sprintf("%s (%dx%d)", r.Name, r.Width, r.Height))
	}
	log.Printf("[Transcoder] Selected %d ABR ladder rungs: %s", len(rungs), strings.Join(rungNames, ", "))

	// 4. Build output directory and FFmpeg CLI command
	hlsOutputDir := filepath.Join(scratchDir, "hls")
	if err := os.MkdirAll(hlsOutputDir, 0755); err != nil {
		errMsg := fmt.Sprintf("creating HLS output directory: %v", err)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}

	ffmpegArgs := BuildFFmpegHLSCommand(masterLocalPath, hlsOutputDir, meta, rungs)
	ffmpegBin := GetFFmpegPath()

	// Report and log the actual command used
	cmdDisplay := fmt.Sprintf("%s %s", ffmpegBin, strings.Join(ffmpegArgs, " "))
	log.Printf("[Transcoder] ════════════════════════════════════════════════════════")
	log.Printf("[Transcoder] Executing FFmpeg command:\n%s", cmdDisplay)
	log.Printf("[Transcoder] ════════════════════════════════════════════════════════")

	// Execute FFmpeg
	cmd := exec.CommandContext(ctx, ffmpegBin, ffmpegArgs...)
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	ffmpegStartTime := time.Now()
	if err := cmd.Run(); err != nil {
		stderrStr := stderrBuf.String()
		if len(stderrStr) > 2000 {
			stderrStr = stderrStr[len(stderrStr)-2000:]
		}
		errMsg := fmt.Sprintf("FFmpeg transcoding failed: %v | Stderr: %s", err, stderrStr)
		log.Printf("[Transcoder] %s", errMsg)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}
	log.Printf("[Transcoder] ✓ FFmpeg transcoding finished in %v", time.Since(ffmpegStartTime))

	// Verify master.m3u8 exists in output
	masterM3U8Path := filepath.Join(hlsOutputDir, "master.m3u8")
	if _, err := os.Stat(masterM3U8Path); err != nil {
		errMsg := fmt.Sprintf("master.m3u8 was not generated: %v", err)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}

	// 5. Upload outputs to "hls" bucket under videos/{videoID}/
	s3Prefix := fmt.Sprintf("videos/%s", videoID)
	log.Printf("[Transcoder] Uploading HLS ladder outputs to S3 bucket %s under prefix %s...", h.storage.HLSBucket(), s3Prefix)
	if err := h.storage.UploadDirectory(ctx, hlsOutputDir, h.storage.HLSBucket(), s3Prefix); err != nil {
		errMsg := fmt.Sprintf("uploading HLS outputs to S3: %v", err)
		h.markFailed(ctx, videoID, errMsg, time.Since(jobStartTime))
		return errors.New(errMsg)
	}

	// 6. Update video status to 'ready' with duration
	if err := h.updateVideoStatus(ctx, videoID, models.VideoStatusReady, nil, meta.Duration); err != nil {
		log.Printf("[Transcoder] Error updating status to ready: %v", err)
		return fmt.Errorf("updating video status to ready: %w", err)
	}

	totalDuration := time.Since(jobStartTime)
	metrics.RecordTranscodeDuration(totalDuration, true, "")
	log.Printf("[Transcoder METRIC] Video ID: %s | Status: SUCCESS | Duration: %v | Rungs: %d", videoID, totalDuration, len(rungs))
	log.Printf("[Transcoder] ★ Video ID %s successfully transcoded and ready in %v!", videoID, totalDuration)
	return nil
}

func (h *TranscodeHandler) markFailed(ctx context.Context, videoID, errMsg string, duration time.Duration) {
	metrics.RecordTranscodeDuration(duration, false, errMsg)
	log.Printf("[Transcoder METRIC] Video ID: %s | Status: FAILED | Duration: %v | Error: %s", videoID, duration, errMsg)
	if err := h.updateVideoStatus(ctx, videoID, models.VideoStatusFailed, &errMsg, 0); err != nil {
		log.Printf("[Transcoder] Error marking video failed: %v", err)
	}
}

func (h *TranscodeHandler) updateVideoStatus(ctx context.Context, videoID, status string, errMsg *string, duration float64) error {
	now := time.Now()
	var err error
	if duration > 0 {
		query := "UPDATE videos SET status = ?, error_message = ?, duration = ?, updated_at = ? WHERE id = ?"
		_, err = database.DB.ExecContext(ctx, query, status, errMsg, duration, now, videoID)
	} else {
		query := "UPDATE videos SET status = ?, error_message = ?, updated_at = ? WHERE id = ?"
		_, err = database.DB.ExecContext(ctx, query, status, errMsg, now, videoID)
	}
	return err
}
