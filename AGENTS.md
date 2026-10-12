PROJECT CONTEXT
OTT video platform. Stack: Go backend, React web app, Flutter mobile app.
Goal: adaptive bitrate (ABR) streaming of high-quality (up to 4K) videos with no
buffering, minimal frame drops, on web and mobile.

ARCHITECTURE (do not deviate without asking)
- Format: HLS with fMP4 (CMAF) segments, 4s segments, keyframes aligned every 2s.
- Transcoding: FFmpeg workers triggered by a job queue (Redis + Asynq).
- Storage: S3-compatible object storage (Cloudflare R2 in prod, MinIO in local dev).
- The Go API NEVER streams video bytes. It only does auth, entitlement checks,
  playlist/URL signing, job orchestration, and watch progress.
- Web player: hls.js. Mobile player: native ExoPlayer/AVPlayer via Flutter.
- Existing auth (JWT access + refresh tokens) must be reused; do not rewrite it.

CONSTRAINTS
- Free/open-source tools only. Verify any new package is actively maintained
  before adding it, and tell me which package you chose and why.
- No secrets in code. Use env vars and a .env.example.
- Mobile caps at 1080p by default; 4K only on web/large screens when the device
  reports decode support.
- Write tests for new backend logic. Do not touch unrelated files.

WORKFLOW
For each task: first produce an implementation plan, wait for approval, then
implement, then run tests/lint and report results with evidence.