package transcode

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"armss-ott-backend/models"

	"github.com/hibiken/asynq"
)

func TestTranscodeHandler_InvalidPayload(t *testing.T) {
	handler := &TranscodeHandler{}
	task := asynq.NewTask(TaskTypeTranscodeVideo, []byte("invalid-json"))

	err := handler.ProcessTask(context.Background(), task)
	if err == nil {
		t.Fatalf("expected error for malformed task payload, got nil")
	}

	// Should skip retry if payload is unparseable
	if !errors.Is(err, asynq.SkipRetry) {
		t.Errorf("expected asynq.SkipRetry for unparseable payload, got %v", err)
	}
}

func TestTranscodeJobPayload_Serialization(t *testing.T) {
	original := models.TranscodeJobPayload{
		VideoID: "test-video-uuid-1234",
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshalling error: %v", err)
	}

	var parsed models.TranscodeJobPayload
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("unmarshalling error: %v", err)
	}

	if parsed.VideoID != original.VideoID {
		t.Errorf("expected %s, got %s", original.VideoID, parsed.VideoID)
	}
}
