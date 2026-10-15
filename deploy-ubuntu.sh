#!/usr/bin/env bash
# ==============================================================================
# ARMSS-OTT Production Docker Deployment Script for Ubuntu Server
# ==============================================================================
set -euo pipefail

echo "========================================================"
echo "      ARMSS-OTT Docker Production Deployment           "
echo "========================================================"

# ── 1. Check Docker Installation ─────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "[!] Docker not found. Installing Docker Engine..."
    sudo apt-get update -qq
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    echo "[✓] Docker installed successfully."
fi

# ── 2. Verify docker compose plugin (not old docker-compose binary) ───────────
if ! docker compose version &> /dev/null; then
    echo "[!] 'docker compose' plugin not found. Installing..."
    sudo apt-get install -y docker-compose-plugin
fi
echo "[✓] $(docker compose version)"

# ── 3. Check for .env file ────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    echo "[i] .env file not found. Creating from .env.example..."
    cp .env.example .env
    RANDOM_JWT=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    sed -i "s/replace-with-a-random-32-character-secret-string-2026/${RANDOM_JWT}/" .env
    echo "[✓] .env generated with a secure random JWT secret."
else
    echo "[✓] .env file found."
fi

# ── 4. Ensure INTERNAL_API_URL is set (CRITICAL: SSR frontend -> backend) ─────
# Without this the Node.js SSR server cannot reach the backend inside Docker,
# causing 404 on every server-side rendered page load.
if ! grep -q "^INTERNAL_API_URL=" .env; then
    echo "INTERNAL_API_URL=http://backend:8090/api" >> .env
    echo "[✓] Injected INTERNAL_API_URL=http://backend:8090/api into .env"
else
    echo "[✓] INTERNAL_API_URL: $(grep '^INTERNAL_API_URL=' .env)"
fi

# ── 5. Read Gateway Port ──────────────────────────────────────────────────────
GATEWAY_PORT=$(grep -E '^GATEWAY_PORT=' .env | cut -d '=' -f2 | tr -d ' ') || true
if [ -z "${GATEWAY_PORT:-}" ]; then
    GATEWAY_PORT="8088"
fi
echo "[i] Gateway Port: $GATEWAY_PORT"

# ── 6. Tear down old containers, rebuild (no-cache), and start ────────────────
echo "[i] Stopping any running containers..."
docker compose down --remove-orphans || true

echo "[i] Building images (--no-cache to pick up all code changes)..."
docker compose build --no-cache

echo "[i] Starting all containers..."
docker compose up -d

# ── 7. Wait for backend healthcheck to go healthy ────────────────────────────
echo ""
echo "[i] Waiting for backend to become healthy..."
MAX_WAIT=120
ELAPSED=0
INTERVAL=5

until docker compose ps backend 2>/dev/null | grep -q "healthy"; do
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
        echo ""
        echo "[✗] Backend did not become healthy within ${MAX_WAIT}s."
        echo "    Check logs with: docker compose logs backend"
        docker compose logs --tail=50 backend
        exit 1
    fi
    printf "."
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
done
echo ""
echo "[✓] Backend healthy after ${ELAPSED}s."

# ── 8. Wait for frontend to start ────────────────────────────────────────────
echo "[i] Waiting for frontend..."
ELAPSED=0
until docker compose ps frontend 2>/dev/null | grep -qE "running|Up"; do
    if [ "$ELAPSED" -ge 60 ]; then
        echo "[✗] Frontend did not start within 60s."
        docker compose logs --tail=40 frontend
        exit 1
    fi
    printf "."
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
done
echo ""
echo "[✓] Frontend running."

# ── 9. Smoke test: backend health endpoint ────────────────────────────────────
echo "[i] Smoke-testing backend /health endpoint..."
if docker compose exec -T backend wget -qO- "http://127.0.0.1:8090/health" 2>/dev/null | grep -q "healthy"; then
    echo "[✓] Backend /health: OK"
else
    echo "[⚠] Backend /health did not return expected response. Check: docker compose logs backend"
fi

# ── 10. Smoke test: API through nginx gateway ─────────────────────────────────
echo "[i] Smoke-testing /api/health through nginx gateway..."
if curl -sf "http://localhost:${GATEWAY_PORT}/api/health" | grep -q "healthy"; then
    echo "[✓] Gateway /api/health: OK — frontend 404 issue is resolved!"
else
    echo "[⚠] Gateway /api/health check failed. Check: docker compose logs nginx"
fi

# ── 11. Final status ──────────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "               Container Status                         "
echo "========================================================"
docker compose ps

echo ""
echo "========================================================"
echo "        Deployment Completed Successfully!              "
echo "========================================================"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  ▶ Gateway:    http://${SERVER_IP}:${GATEWAY_PORT}"
echo "  ▶ API health: http://${SERVER_IP}:${GATEWAY_PORT}/api/health"
echo "  ▶ Backend:    http://${SERVER_IP}:8090  (direct)"
echo "  ▶ Frontend:   http://${SERVER_IP}:8091  (direct)"
echo ""
echo "  ▶ Maintenance commands:"
echo "    docker compose logs -f               # all logs"
echo "    docker compose logs -f backend       # backend only"
echo "    docker compose logs -f frontend      # frontend only"
echo "    docker compose logs -f worker        # transcode worker"
echo "    docker compose restart               # restart all"
echo "    docker compose down                  # stop all"
echo "    docker compose build --no-cache frontend && docker compose up -d frontend"
echo "========================================================"
