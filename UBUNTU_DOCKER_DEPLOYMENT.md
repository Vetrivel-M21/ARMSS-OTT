# ARMSS-OTT Ubuntu Server Deployment Guide (Docker-Only)

This guide walks you through deploying the complete **ARMSS-OTT** platform (Go Backend API, FFmpeg Worker, React 19 SSR Frontend, MySQL, Redis, MinIO S3, and Nginx Gateway) onto an **Ubuntu Server** using **Docker only**, designed specifically to avoid port collisions with your already running containers.

---

## 1. Network & Architecture Diagram

```
[ User Browser / Mobile App ]
             │
             ▼  (HTTPS / 443 with your Domain)
[ Windows Redirect Proxy Server ]
             │
             ▼  (Forwards: http://<UBUNTU_IP>:8088)
┌─────────────────────────────────────────────────────────────────────────────┐
│ UBUNTU SERVER (Docker)                                                      │
│                                                                             │
│  [ Port 8088 ] ──► armss_ott_nginx (Internal Gateway)                       │
│                         │                                                   │
│      ┌──────────────────┼─────────────────────────┐                         │
│      ▼                  ▼                         ▼                         │
│   Path: /            Path: /api/               Path: /hls/                  │
│   Frontend           Backend API               MinIO S3 Storage             │
│   (Port 8091)        (Port 8090)               (Port 9000)                  │
│                         │                         ▲                         │
│                         ├─────────► MySQL (3306)  │                         │
│                         ├─────────► Redis (6379)  │                         │
│                         │             ▲           │                         │
│                         │             │ (Asynq)   │                         │
│                         ▼             ▼           │                         │
│                   FFmpeg Transcode Worker ────────┘                         │
│                                                                             │
│  * All databases & internal ports (3306, 6379, 9000, 8090, 8091) remain     │
│    isolated inside 'armss_ott_network'. ZERO port conflicts with your       │
│    existing running containers!                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites on Ubuntu Server

- **Operating System**: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
- **RAM**: 4GB+ recommended (for FFmpeg CMAF 1080p transcoding)
- **Disk Space**: 20GB+ free storage
- **Docker**: Docker Engine 24+ & Docker Compose v2 (the script automatically installs it if missing)

---

## 3. Quick 3-Step Deployment

### Step 1: Copy or Clone the Code to your Ubuntu Server
On your Ubuntu server, navigate to your desired directory (e.g. `/opt` or `~`):
```bash
git clone https://github.com/your-org/ARMSS-OTT.git
cd ARMSS-OTT
```
*(Or transfer your local project directory to the server via SCP/SFTP).*

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` (using `nano .env`):
```bash
# 1. Your domain name (e.g. ott.yourdomain.com)
DOMAIN=ott.yourdomain.com

# 2. Port to expose on this Ubuntu server (default: 8088)
# Pick any free port that doesn't conflict with your existing containers
GATEWAY_PORT=8088

# 3. Change passwords for production security
MYSQL_PASSWORD=YourStrongDatabasePassword2026
MINIO_ROOT_USER=ottadmin
MINIO_ROOT_PASSWORD=YourStrongMinioPassword2026
JWT_SECRET=generate-a-strong-32-char-random-key
```

### Step 3: Run the Automated Deployment Script
```bash
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh
```

The script will:
1. Verify Docker Engine & Docker Compose.
2. Build the optimized multi-stage Go backend and React SSR containers.
3. Launch all 7 services in isolated network mode.
4. Auto-initialize the S3 video storage buckets (`masters` and `hls`).
5. Output the exact URL to point your Windows redirect proxy to!

---

## 4. Configuring Your Windows Redirect Proxy Server

On your Windows server, configure your reverse proxy (IIS Application Request Routing, Nginx on Windows, or Caddy):

### If using Nginx on Windows:
Add a `server` block to your `nginx.conf`:
```nginx
server {
    listen 80;
    server_name ott.yourdomain.com;

    client_max_body_size 4096M;

    location / {
        proxy_pass http://<UBUNTU_SERVER_IP>:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### If using Windows IIS (URL Rewrite + ARR):
1. Open **IIS Manager** $\rightarrow$ Click **Server Farm** (or Site `ott.yourdomain.com`).
2. Add a **URL Rewrite Rule**:
   - Pattern: `(.*)`
   - Action Type: **Rewrite**
   - Rewrite URL: `http://<UBUNTU_SERVER_IP>:8088/{R:1}`
3. Enable HTTP Request Routing $\rightarrow$ Enable proxy $\rightarrow$ Save.

---

## 5. Daily Maintenance & Useful Commands

| Task | Command |
|---|---|
| **Check running containers** | `docker compose ps` |
| **View live logs (all services)** | `docker compose logs -f` |
| **View Go backend API logs** | `docker compose logs -f backend` |
| **View FFmpeg transcode logs** | `docker compose logs -f worker` |
| **View Nginx gateway logs** | `docker compose logs -f nginx` |
| **Restart the entire stack** | `docker compose restart` |
| **Update code & rebuild** | `git pull && docker compose up -d --build` |
| **Stop all containers** | `docker compose down` |

---

## 6. Default Admin & Test Logins

Once deployed, access the app through your domain and log in:

- **Admin Account**: `admin@armss.com` / `admin123` (Access to Admin Dashboard & Transcoding Manager)
- **VIP Subscriber**: `sarah@techstream.com` / `sarah123` (4K UHD & Multi-device streaming)
- **Standard User**: `demo@armss.com` / `demo123`
