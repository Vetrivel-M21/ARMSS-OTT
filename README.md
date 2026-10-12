# ARMSS-OTT Video Streaming Platform

High-performance, enterprise-grade Adaptive Bitrate (ABR) OTT video streaming platform built with a **Go** backend, **React 19** web application, and **Flutter** mobile application (Android & iOS).

---

## 1. System Architecture

```text
                               ┌────────────────────────┐
                               │   Master Video Asset   │
                               └───────────┬────────────┘
                                           │ Presigned S3 PUT
                                           ▼
┌──────────────────┐           ┌────────────────────────┐
│  React Web App   │           │   MinIO / S3 Storage   │
│ (hls.js / CMAF)  │           │   - masters/ (raw MP4) │
└────────┬─────────┘           │   - hls/ (fMP4 CMAF)   │
         │                     └───────────┬────────────┘
         │ Playback API                    │ Presigned GET
         ▼                                 ▼
┌──────────────────┐  Asynq Jobs  ┌────────────────────────┐
│  Go API Server   ├─────────────►│ Transcoding Workers   │
│ (Auth/Entitle/   │ (Redis 6379) │ (FFmpeg CMAF Ladder)   │
│  Signed URLs)    │              │ 2160p -> 360p          │
└────────▲─────────┘              └────────────────────────┘
         │ Playback API
         │
┌────────┴─────────┐
│  Flutter Mobile  │
│(ExoPlayer/AVPlay)│
└──────────────────┘
```

### Core Architecture Principles:
- **Format**: HLS with fragmented MP4 (fMP4 CMAF) segments, 4s segment length, GOP fixed at 2s, scene-cut disabled.
- **Zero Video Byte Proxying**: The Go API **never** streams video bytes. It exclusively handles authentication, tier entitlements, device concurrency counting, watch progress, and playlist/URL signing. Video segments are fetched directly from S3/CDN via short-lived (5 min) presigned URLs.
- **Transcoding**: Background workers powered by **FFmpeg** orchestrated via **Redis + Asynq**.
- **Adaptive Bitrate (ABR)**:
  - **Web**: Powered by `hls.js`, capped to player container dimensions (`capLevelToPlayerSize`), with hardware decode capability checks via `navigator.mediaCapabilities` before offering 2160p (4K).
  - **Mobile**: Powered by native **ExoPlayer** on Android and **AVPlayer** on iOS, capped at 1080p by default.

---

## 2. Local Setup & Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Go 1.22+](https://go.dev/) (for backend development)
- [Node.js 20+](https://nodejs.org/) (for frontend development)
- [Flutter 3.13+](https://flutter.dev/) (for mobile app development)
- [FFmpeg 6+](https://ffmpeg.org/) (for local transcoding without containers)

### 1-Command Startup (Docker Compose)
From the project root:

```bash
docker-compose up -d
```

This launches all platform services:
| Service | Container Name | Port | Description |
| :--- | :--- | :--- | :--- |
| **Backend API** | `armss_ott_backend` | `8081` | Go API (auth, playback, orchestrator) |
| **Transcode Worker** | `armss_ott_worker` | — | Background FFmpeg transcoding worker |
| **Web App** | `armss_ott_frontend` | `8080` | React 19 + TanStack Start SSR web portal |
| **MinIO S3** | `armss_ott_minio` | `9000` (API) / `9001` (UI)| S3-compatible object storage |
| **Redis** | `armss_ott_redis` | `6379` | Asynq task queue backend |
| **MySQL** | `armss_ott_mysql` | `3306` | Primary relational database |

- **MinIO Web Console**: [http://localhost:9001](http://localhost:9001) (User: `minioadmin`, Password: `minioadmin`)
- **Web OTT Application**: [http://localhost:8080](http://localhost:8080)
- **Backend API Health**: [http://localhost:8081/api/health](http://localhost:8081/api/health)

---

## 3. Environment Variables Reference

Create a `.env` file in `backend/` (or copy from `backend/.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8081` | HTTP server port |
| `ENV` | `development` | Environment mode (`development` or `production`) |
| `JWT_SECRET` | *(Random 32-char key)* | Secret key for JWT access and refresh tokens |
| `MYSQL_HOST` | `localhost` (or `mysql`) | MySQL hostname |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | Database username |
| `MYSQL_PASSWORD` | `Vetri@123` | Database password |
| `MYSQL_DB` | `armss_ott` | Database name (falls back to SQLite if unreachable) |
| `REDIS_ADDR` | `localhost:6379` | Redis server address for Asynq job queue |
| `S3_ENDPOINT` | `http://localhost:9000` | S3 endpoint URL (MinIO locally, Cloudflare R2 in prod) |
| `S3_ACCESS_KEY` | `minioadmin` | S3 Access Key ID |
| `S3_SECRET_KEY` | `minioadmin` | S3 Secret Access Key |
| `S3_REGION` | `us-east-1` | S3 region |
| `S3_USE_PATH_STYLE` | `true` | Must be `true` for MinIO, `false` for AWS/R2 virtual hosts |
| `S3_MASTERS_BUCKET` | `masters` | Bucket name for uploaded raw master files |
| `S3_HLS_BUCKET` | `hls` | Bucket name for generated HLS ladders |
| `TRANSCODE_CONCURRENCY`| `2` | Max parallel FFmpeg transcoding workers |
| `ENABLE_WORKER` | `true` | Whether the API instance also processes transcode jobs |
| `ALLOWED_ORIGINS` | `http://localhost:8080` | Comma-separated list of allowed CORS web origins |

---

## 4. How to Ingest & Transcode a Video

The video ingest pipeline follows a three-step orchestration pattern:

### Step 1: Register Video Record & Acquire Upload Target
Send an authenticated `POST` request with an admin JWT token:

```bash
curl -X POST http://localhost:8081/api/admin/videos \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Crownless (4K Master)"}'
```

**Response (201 Created):**
```json
{
  "id": "e30528fc-3636-419b-aee9-775cfadfa28e",
  "upload_url": "http://localhost:9000/masters/videos/e30528fc.../master.mp4?X-Amz-Signature=...",
  "master_key": "videos/e30528fc-3636-419b-aee9-775cfadfa28e/master.mp4",
  "status": "uploaded"
}
```

### Step 2: Upload Master Video Directly to S3/MinIO
Upload the source MP4 file directly to the presigned PUT target (bypassing the Go API):

```bash
curl -X PUT "<upload_url>" \
  -H "Content-Type: video/mp4" \
  --data-binary "@sample_4k.mp4"
```

### Step 3: Trigger Transcoder Worker
Notify the API that the upload has completed:

```bash
curl -X POST http://localhost:8081/api/admin/videos/e30528fc-3636-419b-aee9-775cfadfa28e/complete \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

The worker probes the master file with `ffprobe`, selects the ladder rungs up to the source resolution, executes `ffmpeg`, and uploads the fMP4 segments to the `hls` bucket. Check status via:

```bash
curl http://localhost:8081/api/admin/videos/e30528fc-3636-419b-aee9-775cfadfa28e \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

When status transitions to `"ready"`, the video is streamable.

---

## 5. Troubleshooting Guide

### Issue 1: CORS on S3 / MinIO Bucket
- **Symptom**: In the browser console:
  ```text
  Access to fetch at 'http://localhost:9000/hls/...' from origin 'http://localhost:8080' has been blocked by CORS policy.
  ```
- **Cause**: The browser attempts to fetch `.m4s` or `.mp4` video segments directly from storage, but the S3 bucket lacks CORS rules.
- **Solution**: Set CORS headers on the `hls` bucket in MinIO/S3:
  1. Using MinIO Client (`mc`):
     ```bash
     mc anonymous set download local/hls
     ```
  2. For AWS S3 or Cloudflare R2, apply the following CORS JSON policy:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
         "AllowedOrigins": ["http://localhost:8080", "http://localhost:5173", "https://yourdomain.com"],
         "ExposeHeaders": ["Content-Length", "Content-Range", "ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

### Issue 2: Expired Signed URLs (401 Unauthorized)
- **Symptom**: Playback halts after 5 minutes with:
  ```json
  {"error": "invalid or expired playback token"}
  ```
- **Cause**: Playback tokens have a 5-minute security lifetime to prevent hotlinking and credential sharing.
- **Solution**:
  - The web player ([`video-player.tsx`](file:///frontend/src/components/video-player.tsx)) and mobile player ([`native_video_player_screen.dart`](file:///mobile/lib/presentation/screens/player/native_video_player_screen.dart)) automatically intercept 401 errors, request a fresh signed URL from `GET /api/videos/:id/playback`, and resume seamlessly from the current timestamp.
  - For server-side tests or direct curls, ensure playback requests are minted within 5 minutes of testing.

### Issue 3: Video Codec & Hardware Decoding Compatibility
- **Audio Codec**: Audio tracks must be encoded as **AAC 128k** (`-c:a aac -b:a 128k`). AC3/EAC3 audio is not natively decoded in all web browsers without specialized licensing.
- **Video Codec**: The pipeline generates H.264 (AVC) CMAF segments (`avc1.640028` for 1080p, `avc1.4d401f` for 720p/480p) to ensure 100% universal decode compatibility across Android, iOS, Safari, Chrome, and Firefox.
- **4K Support**:
  - Web: 2160p is checked at runtime with `navigator.mediaCapabilities.decodingInfo`. If the host machine/GPU lacks hardware AVC decode support for 4K at 60fps, the player gracefully omits the 2160p rung to prevent frame drops.
  - Mobile: Capped at 1080p by default to prevent thermal throttling and excess data usage.

---

## 6. Testing, Verification & Metrics

### Run All Backend Unit & E2E Tests
```bash
cd backend
go test -v ./...
```

### Run Standalone End-to-End Verification CLI
Verifies the complete pipeline (upload $\rightarrow$ transcode $\rightarrow$ playback $\rightarrow$ master playlist $\rightarrow$ segment byte download):

```bash
go run scripts/e2e_verify.go --api-url http://localhost:8081
```

### Run Concurrency Load Tests
- **Using Standalone Go Load Tester (No extra software required)**:
  ```bash
  go run scripts/load_test.go -url http://localhost:8081 -concurrency 50 -duration 10s
  ```
- **Using k6**:
  ```bash
  k6 run tests/load/k6_playback.js
  ```

### Live Metrics & Telemetry
View platform telemetry at any time:
- Prometheus Format: `curl http://localhost:8081/api/metrics`
- JSON Format: `curl "http://localhost:8081/api/metrics?format=json"`
