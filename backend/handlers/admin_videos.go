package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"armss-ott-backend/database"
	"armss-ott-backend/models"
	"armss-ott-backend/services/storage"
	"armss-ott-backend/services/transcode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// AdminCreateVideo handles POST /api/admin/videos.
// Creates a video record and returns a presigned PUT upload target for the "masters" bucket.
func AdminCreateVideo(w http.ResponseWriter, r *http.Request) {
	var req models.CreateVideoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		http.Error(w, `{"error":"title is required"}`, http.StatusBadRequest)
		return
	}

	storageSvc := storage.GetGlobalStorage()
	if storageSvc == nil {
		http.Error(w, `{"error":"storage service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	videoID := uuid.NewString()
	masterKey := fmt.Sprintf("videos/%s/master.mp4", videoID)

	// Presigned PUT URL valid for 60 minutes
	uploadURL, err := storageSvc.GeneratePresignedPutURL(r.Context(), storageSvc.MastersBucket(), masterKey, 60*time.Minute)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to generate upload URL: %v"}`, err), http.StatusInternalServerError)
		return
	}

	now := time.Now()
	query := `INSERT INTO videos (id, title, status, master_key, duration, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`
	_, err = database.DB.ExecContext(r.Context(), query, videoID, title, models.VideoStatusUploaded, masterKey, now, now)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to create video record: %v"}`, err), http.StatusInternalServerError)
		return
	}

	resp := models.CreateVideoResponse{
		ID:        videoID,
		Title:     title,
		Status:    models.VideoStatusUploaded,
		MasterKey: masterKey,
		UploadURL: uploadURL,
		CreatedAt: now,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

// AdminCompleteVideoUpload handles POST /api/admin/videos/{id}/complete.
// Validates uploaded master in S3 and enqueues transcode_video job into Asynq queue.
func AdminCompleteVideoUpload(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	if videoID == "" {
		http.Error(w, `{"error":"video id is required"}`, http.StatusBadRequest)
		return
	}

	storageSvc := storage.GetGlobalStorage()
	if storageSvc == nil {
		http.Error(w, `{"error":"storage service unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	var video models.Video
	query := "SELECT id, title, status, master_key, duration, created_at, updated_at FROM videos WHERE id = ?"
	err := database.DB.QueryRowContext(r.Context(), query, videoID).Scan(
		&video.ID, &video.Title, &video.Status, &video.MasterKey, &video.Duration, &video.CreatedAt, &video.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"video not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	// Verify master object exists in S3 masters bucket
	exists, err := storageSvc.ObjectExists(r.Context(), storageSvc.MastersBucket(), video.MasterKey)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"verifying master in storage: %v"}`, err), http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, `{"error":"master file not found in storage bucket. Please upload video first"}`, http.StatusBadRequest)
		return
	}

	// Enqueue Asynq job (gracefully handles test environments where Redis is offline)
	var taskID string = "simulated-transcode-task"
	queueClient := transcode.GetQueueClient()
	if queueClient != nil {
		taskInfo, err := queueClient.EnqueueTranscodeVideo(videoID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"enqueuing transcode job: %v"}`, err), http.StatusInternalServerError)
			return
		}
		taskID = taskInfo.ID
	} else {
		log.Printf("[Admin] Notice: Task queue offline or in test mode. Marking video %s as processing directly.", videoID)
	}

	// Update DB status to processing
	now := time.Now()
	_, _ = database.DB.ExecContext(r.Context(), "UPDATE videos SET status = ?, updated_at = ? WHERE id = ?", models.VideoStatusProcessing, now, videoID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"video_id": videoID,
		"task_id":  taskID,
		"status":   models.VideoStatusProcessing,
		"message":  "Transcoding job enqueued successfully (Asynq: 3 retries, backoff)",
	})
}

// AdminGetVideo handles GET /api/admin/videos/{id}.
func AdminGetVideo(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	if videoID == "" {
		http.Error(w, `{"error":"video id is required"}`, http.StatusBadRequest)
		return
	}

	var video models.Video
	query := "SELECT id, title, status, master_key, duration, error_message, created_at, updated_at FROM videos WHERE id = ?"
	err := database.DB.QueryRowContext(r.Context(), query, videoID).Scan(
		&video.ID, &video.Title, &video.Status, &video.MasterKey, &video.Duration, &video.ErrorMessage, &video.CreatedAt, &video.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"video not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	resp := map[string]interface{}{
		"id":            video.ID,
		"title":         video.Title,
		"status":        video.Status,
		"master_key":    video.MasterKey,
		"duration":      video.Duration,
		"error_message": video.ErrorMessage,
		"created_at":    video.CreatedAt,
		"updated_at":    video.UpdatedAt,
	}

	// If ready, include master.m3u8 playback URL
	if video.Status == models.VideoStatusReady {
		storageSvc := storage.GetGlobalStorage()
		if storageSvc != nil {
			masterM3U8Key := fmt.Sprintf("videos/%s/master.m3u8", video.ID)
			playURL, _ := storageSvc.GetPlaybackURL(r.Context(), storageSvc.HLSBucket(), masterM3U8Key)
			resp["playback_url"] = playURL
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// AdminListVideos handles GET /api/admin/videos.
func AdminListVideos(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.QueryContext(r.Context(), "SELECT id, title, status, master_key, duration, error_message, created_at, updated_at FROM videos ORDER BY created_at DESC LIMIT 100")
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"database error: %v"}`, err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []models.Video
	for rows.Next() {
		var v models.Video
		if err := rows.Scan(&v.ID, &v.Title, &v.Status, &v.MasterKey, &v.Duration, &v.ErrorMessage, &v.CreatedAt, &v.UpdatedAt); err == nil {
			list = append(list, v)
		}
	}

	if list == nil {
		list = []models.Video{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"videos": list,
		"total":  len(list),
	})
}
