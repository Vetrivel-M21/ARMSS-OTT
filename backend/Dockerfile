# ----------------------------------------------------
# ARMSS-OTT High-Performance Go Backend Dockerfile
# Multi-stage build with static binaries for 100% reliability
# ----------------------------------------------------
FROM golang:1.26-bookworm AS builder

WORKDIR /app

# Download Go modules (git and ca-certificates are pre-installed in golang:bookworm)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically compiled Linux binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o armss-ott-backend .

# ----------------------------------------------------
# Final Minimal Production Image
# ----------------------------------------------------
FROM debian:bookworm-slim

WORKDIR /app

# 1. Copy CA certificates & timezone data from builder (zero apt-get network calls)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# 2. Copy static, self-contained FFmpeg & FFprobe (bypasses broken Debian CDN mirrors)
COPY --from=mwader/static-ffmpeg:7.1 /ffmpeg /ffprobe /usr/local/bin/

# 3. Copy Go backend binary from builder
COPY --from=builder /app/armss-ott-backend /app/armss-ott-backend

# 4. Create dedicated, unique ARMSS-OTT uploads directory
RUN mkdir -p /app/armss_ott_uploads

ENV PORT=8090 \
    ENV=production \
    UPLOADS_DIR=/app/armss_ott_uploads

EXPOSE 8090

CMD ["/app/armss-ott-backend"]
