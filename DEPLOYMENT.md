# ARMSS-OTT Production Deployment & Architecture Guide

This document provides a comprehensive guide for deploying and maintaining the **ARMSS-OTT** enterprise streaming platform with its separated full-stack architecture.

---

## 1. Project Architecture Overview

The repository has been decoupled into two independent, production-ready modules:

```text
ARMSS-OTT/
├── backend/                  # High-Performance Golang Microservice
│   ├── database/             # Schema definitions, migrations & auto-fallback (MySQL / SQLite)
│   ├── handlers/             # REST API Handlers (Auth, Catalog, Streaming, Sync, Analytics)
│   ├── middleware/           # JWT Auth, Admin guards, and CORS configuration
│   ├── models/               # Data structures & Analytics models
│   ├── public/uploads/       # Media uploads (trailers, video assets, posters)
│   ├── armss-ott-backend.exe # Standalone compiled binary
│   ├── main.go               # Router & HTTP server bootstrap
│   ├── Dockerfile            # Multi-stage optimized Linux container build
│   └── .env.example          # Backend environment variables template
│
├── frontend/                 # High-Performance Modern React 19 + Vite SPA
│   ├── src/
│   │   ├── components/       # Navigation, Player, Carousel, Modal, Live Chat UI
│   │   ├── routes/           # Main OTT views, Player, and Admin Dashboard
│   │   │   └── admin.tsx     # Enhanced Admin Portal with User-Perspective Analytics
│   │   └── lib/              # API Client (configured with VITE_API_BASE_URL)
│   ├── public/               # Static assets & brand media
│   ├── package.json          # Dependencies & scripts
│   ├── vite.config.ts        # Vite build & proxy configuration
│   ├── Dockerfile            # Multi-stage Nginx production container
│   ├── nginx.conf            # High-speed Nginx SPA configuration
│   ├── .env.development      # Dev environment API configuration
│   └── .env.production.example # Production environment API configuration
│
├── docker-compose.yml        # Multi-container orchestration (Backend + Frontend)
└── DEPLOYMENT.md             # This deployment manual
```

---

## 2. Admin User-Perspective Analytics Features

The newly implemented **Admin Analytics** screen provides real-time streaming intelligence and granular user activity tracking:

### Key Metrics & KPIs:
1. **Daily Active Users (DAU)**: Live count of unique viewers active or logged in during the past 24 hours.
2. **Weekly Active Users (WAU)** & **Monthly Active Users (MAU)**: Aggregated active viewer base across 7-day and 30-day rolling windows.
3. **Total Stream Hours**: Total accumulated watch time across the platform, formatted into clean human-readable hours and minutes.
4. **Average Session Duration**: Real-time average streaming duration per session per viewer.
5. **Platform Completion Rate**: Global percentage of content watched to completion.
6. **Estimated Monthly Revenue**: Live calculated recurring revenue based on active subscription tiers.

### Interactive Visualizations & Deep-Dives:
- **Dual-Gradient Area Chart**: Interactive Recharts trendline toggling between **Active Users & Logins** and **Watch Hours** over 7-day, 14-day, and 30-day intervals.
- **Top Watched Content Leaderboard**: Title rankings showing total unique viewers, stream hours, and completion percentage progress indicators.
- **User-Perspective Deep-Dive Table**:
  - Individual viewer name and email.
  - Active subscription tier tag (`Free`, `Standard`, `Premium`).
  - Total watch time accumulated by that user.
  - Number of unique titles streamed.
  - Average completion rate bar per user.
  - Real-time active status pulse indicator (Green pulse for viewers active within 15 minutes, or relative timestamp e.g. "2 hours ago").
  - Instant search and tier filtering.

---

## 3. Quick Start (Local Development)

### Running the Backend:
```bash
cd backend
# 1. Option A: Run directly with Go
go run main.go

# 2. Option B: Run pre-compiled binary
./armss-ott-backend.exe
```
*The backend automatically starts on `http://localhost:8081`.*

### Running the Frontend:
```bash
cd frontend
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*The frontend automatically starts on `http://localhost:8080` (or `http://localhost:5173`).*

---

## 4. Production Deployment with Docker Compose (Recommended)

To deploy both services with a single command:

```bash
# From the project root
docker compose up -d --build
```

### Verification:
- **Frontend**: Navigate to `http://YOUR_SERVER_IP:8080`
- **Backend API**: Navigate to `http://YOUR_SERVER_IP:8081/api/health`

---

## 5. Standalone Production Deployment

### A. Deploying Backend on a Linux VPS (Ubuntu / Debian / CentOS)
1. **Compile for Linux**:
   ```bash
   cd backend
   CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o armss-ott-backend .
   ```
2. **Transfer Binary & Assets**:
   Copy `armss-ott-backend` and `public/uploads` to `/opt/armss-ott/backend`.
3. **Create Systemd Service (`/etc/systemd/system/armss-ott-backend.service`)**:
   ```ini
   [Unit]
   Description=ARMSS-OTT Backend Service
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/armss-ott/backend
   ExecStart=/opt/armss-ott/backend/armss-ott-backend
   Restart=always
   RestartSec=5
   Environment=PORT=8081
   Environment=ENV=production
   Environment=JWT_SECRET=YOUR_SECURE_JWT_SECRET_32_CHARS
   Environment=ALLOWED_ORIGINS=https://ott.yourdomain.com

   [Install]
   WantedBy=multi-user.target
   ```
4. **Start & Enable Service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now armss-ott-backend
   ```

### B. Deploying Frontend to Vercel / Netlify / Cloudflare Pages
1. Point your Git repository root directory to `frontend`.
2. Set Environment Variable:
   - `VITE_API_BASE_URL`: `https://api.yourdomain.com/api`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### C. Nginx Reverse Proxy Configuration (Recommended for VPS)
```nginx
server {
    listen 80;
    server_name ott.yourdomain.com;

    # Frontend Static SPA
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API & Uploads
    location /api/ {
        proxy_pass http://127.0.0.1:8081/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8081/uploads/;
        proxy_set_header Host $host;
    }
}
```

---

## 6. Default Admin & Demo Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Platform Administrator** | `admin@armss.com` | `admin123` | Full Admin & User Analytics Portal |
| **Premium VIP Subscriber** | `sarah@techstream.com` | `sarah123` | 4K UHD, Multi-Device, Ad-Free |
| **Standard Subscriber** | `marcus@filmlover.org` | `marcus123` | 1080p FHD, 2 Devices |
| **Free Tier User** | `demo@armss.com` | `demo123` | Standard Catalog Access |
| **Premium VIP (Alt)** | `premium@armss.com` | `armss123` | 4K UHD VIP Access |
| **Standard (Alt)** | `standard@armss.com` | `armss123` | 1080p FHD Access |
| **Free Tier (Alt)** | `free@armss.com` | `armss123` | Standard Catalog Access |
