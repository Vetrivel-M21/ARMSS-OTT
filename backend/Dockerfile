# ----------------------------------------------------
# ARMSS-OTT High-Performance Go Backend Dockerfile
# ----------------------------------------------------
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Download Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically compiled binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o armss-ott-backend .

# ----------------------------------------------------
# Final Minimal Distroless / Alpine Image
# ----------------------------------------------------
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata sqlite-libs ffmpeg

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
