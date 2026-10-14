# ----------------------------------------------------
# ARMSS-OTT High-Performance Go Backend Dockerfile
# Using Debian Bookworm for 100% reliable network package downloads
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

# Install FFmpeg, CA certificates, and timezones from Debian's CDN
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/armss-ott-backend /app/armss-ott-backend

# Create directory for uploads and database persistence
RUN mkdir -p /app/public/uploads /app/data

ENV PORT=8090 \
    ENV=production \
    UPLOADS_DIR=/app/public/uploads \
    SQLITE_DB=/app/data/armss_ott.db

EXPOSE 8090

VOLUME ["/app/public/uploads", "/app/data"]

CMD ["/app/armss-ott-backend"]
