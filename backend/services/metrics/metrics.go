package metrics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Metrics holds in-memory telemetry counters and duration summaries.
type Metrics struct {
	mu sync.RWMutex

	// Transcoding telemetry
	transcodeSuccessTotal  uint64
	transcodeFailuresTotal uint64
	transcodeDurationSum   uint64 // in milliseconds
	transcodeDurationCount uint64
	transcodeBuckets       map[string]*uint64 // "<5s", "<15s", "<30s", "<60s", ">60s"
	transcodeFailuresByErr map[string]uint64

	// Playback telemetry
	playbackStartsTotal  uint64
	playbackStartsWeb    uint64
	playbackStartsMobile uint64
	playbackStartsByTier map[string]uint64

	// Active streams gauge
	activeStreams int64
}

var globalMetrics = newMetrics()

func newMetrics() *Metrics {
	m := &Metrics{
		transcodeBuckets: map[string]*uint64{
			"5s":  new(uint64),
			"15s": new(uint64),
			"30s": new(uint64),
			"60s": new(uint64),
			"inf": new(uint64),
		},
		transcodeFailuresByErr: make(map[string]uint64),
		playbackStartsByTier:   make(map[string]uint64),
	}
	return m
}

// GetGlobalMetrics returns the singleton metrics instance.
func GetGlobalMetrics() *Metrics {
	return globalMetrics
}

// RecordTranscodeDuration tracks transcode duration, success/failure, and bucket distribution.
func RecordTranscodeDuration(duration time.Duration, success bool, errReason string) {
	globalMetrics.recordTranscode(duration, success, errReason)
}

func (m *Metrics) recordTranscode(duration time.Duration, success bool, errReason string) {
	durMs := uint64(duration.Milliseconds())
	atomic.AddUint64(&m.transcodeDurationSum, durMs)
	atomic.AddUint64(&m.transcodeDurationCount, 1)

	durSec := duration.Seconds()
	if durSec <= 5 {
		atomic.AddUint64(m.transcodeBuckets["5s"], 1)
	} else if durSec <= 15 {
		atomic.AddUint64(m.transcodeBuckets["15s"], 1)
	} else if durSec <= 30 {
		atomic.AddUint64(m.transcodeBuckets["30s"], 1)
	} else if durSec <= 60 {
		atomic.AddUint64(m.transcodeBuckets["60s"], 1)
	} else {
		atomic.AddUint64(m.transcodeBuckets["inf"], 1)
	}

	if success {
		atomic.AddUint64(&m.transcodeSuccessTotal, 1)
	} else {
		atomic.AddUint64(&m.transcodeFailuresTotal, 1)
		m.mu.Lock()
		cleanReason := sanitizeLabel(errReason)
		m.transcodeFailuresByErr[cleanReason]++
		m.mu.Unlock()
	}
}

// RecordPlaybackStart records a new playback session initialization.
func RecordPlaybackStart(clientType string, maxHeight int, userTier string) {
	globalMetrics.recordPlayback(clientType, maxHeight, userTier)
}

func (m *Metrics) recordPlayback(clientType string, maxHeight int, userTier string) {
	atomic.AddUint64(&m.playbackStartsTotal, 1)

	if strings.ToLower(clientType) == "mobile" {
		atomic.AddUint64(&m.playbackStartsMobile, 1)
	} else {
		atomic.AddUint64(&m.playbackStartsWeb, 1)
	}

	tierKey := strings.ToLower(strings.TrimSpace(userTier))
	if tierKey == "" {
		tierKey = "free"
	}
	m.mu.Lock()
	m.playbackStartsByTier[tierKey]++
	m.mu.Unlock()
}

// IncActiveStreams increments the active stream gauge.
func IncActiveStreams() {
	atomic.AddInt64(&globalMetrics.activeStreams, 1)
}

// DecActiveStreams decrements the active stream gauge.
func DecActiveStreams() {
	atomic.AddInt64(&globalMetrics.activeStreams, -1)
}

// Handler handles GET /api/metrics and GET /metrics.
// Returns Prometheus exposition format by default or JSON if requested.
func Handler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("format") == "json" || strings.Contains(r.Header.Get("Accept"), "application/json") {
		serveJSON(w)
		return
	}
	servePrometheus(w)
}

func serveJSON(w http.ResponseWriter) {
	m := globalMetrics
	m.mu.RLock()
	defer m.mu.RUnlock()

	var avgMs float64
	count := atomic.LoadUint64(&m.transcodeDurationCount)
	if count > 0 {
		avgMs = float64(atomic.LoadUint64(&m.transcodeDurationSum)) / float64(count)
	}

	data := map[string]interface{}{
		"transcode": map[string]interface{}{
			"success_total":        atomic.LoadUint64(&m.transcodeSuccessTotal),
			"failures_total":       atomic.LoadUint64(&m.transcodeFailuresTotal),
			"duration_avg_ms":      avgMs,
			"duration_count":       count,
			"duration_sum_ms":      atomic.LoadUint64(&m.transcodeDurationSum),
			"duration_buckets_sec": map[string]uint64{
				"le_5":  atomic.LoadUint64(m.transcodeBuckets["5s"]),
				"le_15": atomic.LoadUint64(m.transcodeBuckets["15s"]),
				"le_30": atomic.LoadUint64(m.transcodeBuckets["30s"]),
				"le_60": atomic.LoadUint64(m.transcodeBuckets["60s"]),
				"inf":   atomic.LoadUint64(m.transcodeBuckets["inf"]),
			},
			"failures_by_reason": m.transcodeFailuresByErr,
		},
		"playback": map[string]interface{}{
			"starts_total":   atomic.LoadUint64(&m.playbackStartsTotal),
			"starts_web":     atomic.LoadUint64(&m.playbackStartsWeb),
			"starts_mobile":  atomic.LoadUint64(&m.playbackStartsMobile),
			"starts_by_tier": m.playbackStartsByTier,
			"active_streams": atomic.LoadInt64(&m.activeStreams),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}

func servePrometheus(w http.ResponseWriter) {
	m := globalMetrics
	m.mu.RLock()
	defer m.mu.RUnlock()

	var b strings.Builder

	// Transcode metrics
	b.WriteString("# HELP ott_transcode_success_total Total successful video transcode jobs\n")
	b.WriteString("# TYPE ott_transcode_success_total counter\n")
	b.WriteString(fmt.Sprintf("ott_transcode_success_total %d\n\n", atomic.LoadUint64(&m.transcodeSuccessTotal)))

	b.WriteString("# HELP ott_transcode_failures_total Total failed video transcode jobs\n")
	b.WriteString("# TYPE ott_transcode_failures_total counter\n")
	b.WriteString(fmt.Sprintf("ott_transcode_failures_total %d\n", atomic.LoadUint64(&m.transcodeFailuresTotal)))
	for reason, c := range m.transcodeFailuresByErr {
		b.WriteString(fmt.Sprintf("ott_transcode_failures_by_reason{reason=\"%s\"} %d\n", reason, c))
	}
	b.WriteString("\n")

	b.WriteString("# HELP ott_transcode_duration_seconds Transcode execution duration in seconds\n")
	b.WriteString("# TYPE ott_transcode_duration_seconds histogram\n")
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_bucket{le=\"5.0\"} %d\n", atomic.LoadUint64(m.transcodeBuckets["5s"])))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_bucket{le=\"15.0\"} %d\n", atomic.LoadUint64(m.transcodeBuckets["15s"])))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_bucket{le=\"30.0\"} %d\n", atomic.LoadUint64(m.transcodeBuckets["30s"])))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_bucket{le=\"60.0\"} %d\n", atomic.LoadUint64(m.transcodeBuckets["60s"])))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_bucket{le=\"+Inf\"} %d\n", atomic.LoadUint64(&m.transcodeDurationCount)))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_sum %.3f\n", float64(atomic.LoadUint64(&m.transcodeDurationSum))/1000.0))
	b.WriteString(fmt.Sprintf("ott_transcode_duration_seconds_count %d\n\n", atomic.LoadUint64(&m.transcodeDurationCount)))

	// Playback metrics
	b.WriteString("# HELP ott_playback_starts_total Total playback sessions started\n")
	b.WriteString("# TYPE ott_playback_starts_total counter\n")
	b.WriteString(fmt.Sprintf("ott_playback_starts_total{client=\"web\"} %d\n", atomic.LoadUint64(&m.playbackStartsWeb)))
	b.WriteString(fmt.Sprintf("ott_playback_starts_total{client=\"mobile\"} %d\n", atomic.LoadUint64(&m.playbackStartsMobile)))
	for tier, c := range m.playbackStartsByTier {
		b.WriteString(fmt.Sprintf("ott_playback_starts_by_tier{tier=\"%s\"} %d\n", tier, c))
	}
	b.WriteString("\n")

	b.WriteString("# HELP ott_active_streams Current number of active stream sessions\n")
	b.WriteString("# TYPE ott_active_streams gauge\n")
	b.WriteString(fmt.Sprintf("ott_active_streams %d\n", atomic.LoadInt64(&m.activeStreams)))

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write([]byte(b.String()))
}

func sanitizeLabel(s string) string {
	s = strings.ReplaceAll(s, "\"", "")
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > 40 {
		return s[:40]
	}
	if s == "" {
		return "unknown"
	}
	return s
}
