#!/usr/bin/env bash
# ==============================================================================
# ARMSS-OTT Production Docker Deployment Script for Ubuntu Server
# ==============================================================================
set -e

echo "========================================================"
echo "      ARMSS-OTT Docker Production Deployment           "
echo "========================================================"

# 1. Check Docker Installation
if ! command -v docker &> /dev/null; then
    echo "[!] Docker not found. Installing Docker Engine..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    echo "[✓] Docker installed successfully."
fi

# 2. Check for .env file
if [ ! -f ".env" ]; then
    echo "[i] .env file not found. Creating from .env.example..."
    cp .env.example .env
    # Generate a random 32-character JWT secret
    RANDOM_JWT=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    sed -i "s/replace-with-a-random-32-character-secret-string-2026/${RANDOM_JWT}/" .env
    echo "[✓] .env generated with a secure random JWT secret."
fi

# 3. Read Gateway Port
GATEWAY_PORT=$(grep -E '^GATEWAY_PORT=' .env | cut -d '=' -f2 | tr -d ' ' || echo "8088")
if [ -z "$GATEWAY_PORT" ]; then
    GATEWAY_PORT="8088"
fi

echo "[i] Target Gateway Port on Ubuntu: $GATEWAY_PORT"
echo "[i] Building and launching containers in detached mode..."

# 4. Build and start containers with docker compose
docker compose up -d --build --remove-orphans

echo ""
echo "========================================================"
echo "               Container Status                         "
echo "========================================================"
docker compose ps

echo ""
echo "========================================================"
echo "        Deployment Completed Successfully!             "
echo "========================================================"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "▶ ARMSS-OTT Gateway is running on: http://${SERVER_IP}:${GATEWAY_PORT}"
echo ""
echo "▶ WINDOWS REDIRECT PROXY CONFIGURATION:"
echo "  In your Windows redirect proxy server, point your domain to:"
echo "  Target URL / Forward: http://${SERVER_IP}:${GATEWAY_PORT}"
echo ""
echo "▶ Useful Maintenance Commands:"
echo "  - View live logs:      docker compose logs -f"
echo "  - Check backend logs:  docker compose logs -f backend"
echo "  - Check worker logs:   docker compose logs -f worker"
echo "  - Restart services:    docker compose restart"
echo "  - Stop all:            docker compose down"
echo "========================================================"
