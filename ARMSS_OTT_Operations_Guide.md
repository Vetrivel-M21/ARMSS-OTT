# 📖 ARMSS-OTT Docker Operations Guide
> Complete runbook for managing containers, volumes, and network on your Ubuntu server.

---

## 📊 Quick Status Check (Always Start Here)

```bash
# See ALL containers — status, health, ports
docker compose ps

# One-line health summary
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

**Healthy output looks like:**
```
NAME                  STATUS                    PORTS
armss_ott_nginx       Up 2 hours                0.0.0.0:8088->80/tcp
armss_ott_frontend    Up 2 hours                0.0.0.0:8091->8091/tcp
armss_ott_backend     Up 2 hours (healthy)      0.0.0.0:8090->8090/tcp
armss_ott_worker      Up 2 hours
armss_ott_mysql       Up 2 hours (healthy)      3306/tcp
armss_ott_redis       Up 2 hours (healthy)      6379/tcp
armss_ott_seaweedfs   Up 2 hours                8333/tcp
```

> ⚠️ If you see `(unhealthy)`, `Exited`, or `Restarting` — jump to the **Troubleshooting** section below.

---

## 🪵 Viewing Logs (Most Important Skill)

```bash
# All containers live logs
docker compose logs -f

# Single container logs (most useful)
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
docker compose logs -f mysql
docker compose logs -f redis
docker compose logs -f worker
docker compose logs -f seaweedfs

# Last 100 lines only (no live follow)
docker compose logs --tail=100 backend

# Logs since a specific time
docker compose logs --since="2026-10-15T10:00:00" backend

# Show timestamps in logs
docker compose logs -f -t backend
```

---

## 🔄 Container Management

### Start / Stop / Restart

```bash
# Restart ONE container (fastest — keeps data)
docker compose restart backend
docker compose restart frontend
docker compose restart nginx

# Restart ALL containers
docker compose restart

# Stop all (keeps volumes/data)
docker compose stop

# Start all (after stop)
docker compose start

# Stop + remove containers (keeps volumes/data safe)
docker compose down

# Stop + remove containers + remove volumes ⚠️ DANGER: DELETES ALL DATA
docker compose down -v
```

### Rebuild & Redeploy

```bash
# Rebuild ONE service and restart it (e.g., after code change)
docker compose build --no-cache frontend
docker compose up -d frontend

# Rebuild backend only
docker compose build --no-cache backend
docker compose up -d backend worker    # worker uses same image

# Rebuild everything from scratch
docker compose down
docker compose build --no-cache
docker compose up -d

# Pull latest base images (nginx, mysql, redis, seaweedfs)
docker compose pull
docker compose up -d
```

---

## 🔬 Inspecting Containers (Go Inside)

```bash
# Open a shell INSIDE the backend container
docker compose exec backend bash

# Open a shell inside frontend
docker compose exec frontend sh      # alpine uses sh not bash

# Open MySQL client directly
docker compose exec mysql mysql -uroot -p armss_ott
# (enter your MYSQL_PASSWORD when prompted)

# Open Redis CLI
docker compose exec redis redis-cli

# Check environment variables inside a container
docker compose exec backend env | sort

# Check what process is running
docker compose exec backend ps aux

# Check network connectivity — can backend reach MySQL?
docker compose exec backend ping mysql
docker compose exec backend ping redis
docker compose exec backend ping seaweedfs
```

---

## 💽 Volume Management

### List & Inspect

```bash
# List all volumes
docker volume ls | grep armss

# Inspect a volume (see where it's stored on disk)
docker volume inspect armss-ott_mysql_data
docker volume inspect armss-ott_redis_data
docker volume inspect armss-ott_seaweedfs_data
docker volume inspect armss-ott_backend_uploads
```

### Backup Volumes

```bash
# ── Backup MySQL database ──────────────────────────────────────────────────
docker compose exec mysql mysqldump -uroot -p"${MYSQL_PASSWORD:-Vetri@123}" armss_ott \
  > backup_mysql_$(date +%Y%m%d_%H%M%S).sql

# ── Backup uploads (posters, backdrops, avatars) ───────────────────────────
docker run --rm \
  -v armss-ott_backend_uploads:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup_uploads_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# ── Backup SeaweedFS video data ────────────────────────────────────────────
docker run --rm \
  -v armss-ott_seaweedfs_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup_seaweedfs_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Restore Volumes

```bash
# ── Restore MySQL database ─────────────────────────────────────────────────
docker compose exec -T mysql mysql -uroot -p"${MYSQL_PASSWORD:-Vetri@123}" armss_ott \
  < backup_mysql_20261015_103000.sql

# ── Restore uploads ────────────────────────────────────────────────────────
docker run --rm \
  -v armss-ott_backend_uploads:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup_uploads_20261015_103000.tar.gz -C /data
```

### Delete a Volume (DANGER — permanent)

```bash
# Stop containers first
docker compose down

# Delete ONLY uploads (e.g., to free space — data is gone forever)
docker volume rm armss-ott_backend_uploads

# Delete ALL volumes (wipes entire app data)
docker volume rm armss-ott_mysql_data armss-ott_redis_data \
  armss-ott_seaweedfs_data armss-ott_backend_uploads
```

---

## 🌐 Network Management

```bash
# List networks
docker network ls | grep armss

# Inspect the network — see which containers are connected + their IPs
docker network inspect armss-ott_armss_ott_network

# Check if two containers can see each other
docker compose exec frontend ping backend
docker compose exec backend ping mysql
docker compose exec worker ping seaweedfs

# See all open ports inside a container
docker compose exec backend ss -tlnp
```

---

## 🚨 Troubleshooting — Common Problems & Fixes

### ❌ Container shows `Exited` or keeps `Restarting`

```bash
# Step 1: Check why it exited
docker compose logs --tail=50 backend

# Step 2: Check the exit code
docker compose ps backend

# Step 3: Try starting it manually to see live errors
docker compose up backend    # (no -d flag = see output directly)
```

---

### ❌ Frontend shows 404 on API calls

```bash
# 1. Verify INTERNAL_API_URL is set
docker compose exec frontend env | grep INTERNAL_API_URL
# Expected: INTERNAL_API_URL=http://backend:8090/api

# 2. Can frontend reach backend?
docker compose exec frontend wget -qO- http://backend:8090/health
# Expected: {"status":"healthy",...}

# 3. Is backend healthy?
docker compose ps backend
# Expected: (healthy) in STATUS column

# 4. If not healthy, check backend logs
docker compose logs --tail=50 backend
```

---

### ❌ Nginx returns 502 Bad Gateway

```bash
# 502 means nginx can't reach backend or frontend
# Step 1: Check if backend is running
docker compose ps backend

# Step 2: Check nginx config is loaded
docker compose exec nginx nginx -t

# Step 3: Reload nginx config without restart
docker compose exec nginx nginx -s reload

# Step 4: Check nginx logs
docker compose logs --tail=30 nginx
```

---

### ❌ MySQL won't start / stays unhealthy

```bash
# Check MySQL logs for errors
docker compose logs --tail=50 mysql

# Common fix: wrong password in .env
grep MYSQL_PASSWORD .env

# If MySQL data is corrupted, nuclear option (⚠️ deletes all DB data):
docker compose down
docker volume rm armss-ott_mysql_data
docker compose up -d
```

---

### ❌ Backend can't connect to MySQL

```bash
# Check backend logs
docker compose logs --tail=30 backend

# Is MySQL healthy?
docker compose ps mysql

# Test connection manually
docker compose exec backend \
  wget -qO- "http://localhost:8090/api/health"
# Look for "driver":"mysql" vs "driver":"sqlite"
# sqlite = MySQL connection failed, using fallback
```

---

### ❌ Redis not working / Worker not picking up jobs

```bash
# Check Redis is alive
docker compose exec redis redis-cli ping
# Expected: PONG

# Check queue depth (how many jobs waiting)
docker compose exec redis redis-cli llen asynq:default

# Check worker logs
docker compose logs --tail=50 worker

# Restart worker
docker compose restart worker
```

---

### ❌ SeaweedFS / Video not loading (HLS 404)

```bash
# Check SeaweedFS is running
docker compose ps seaweedfs
docker compose logs --tail=30 seaweedfs

# Test S3 API directly
docker compose exec backend \
  wget -qO- http://seaweedfs:8333/ --server-response 2>&1 | head -5

# List buckets
docker compose exec backend \
  wget -qO- "http://seaweedfs:8333/?list-type=2"

# Restart SeaweedFS
docker compose restart seaweedfs
```

---

### ❌ Disk Space Full

```bash
# Check disk usage
df -h /

# See Docker disk usage breakdown
docker system df

# Clean up unused images, stopped containers, dangling volumes
docker system prune -f

# More aggressive — remove ALL unused images (keeps running containers safe)
docker system prune -af

# See which volume is biggest
docker system df -v | grep armss
```

---

### ❌ Out of Memory / Container killed (OOMKilled)

```bash
# Check if any container was OOM-killed
docker inspect armss_ott_backend | grep -A5 OOMKilled

# Check current memory usage
docker stats --no-stream

# Live memory monitor
docker stats
```

---

## 🩺 Full Health Check Script

Run this any time you want a complete status report:

```bash
echo "=== Container Status ===" && docker compose ps
echo ""
echo "=== Backend API Health ===" && \
  docker compose exec -T backend wget -qO- http://127.0.0.1:8090/api/health 2>/dev/null || echo "FAILED"
echo ""
echo "=== Gateway Health ===" && \
  curl -sf http://localhost:8088/api/health || echo "FAILED"
echo ""
echo "=== MySQL ===" && \
  docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 --silent && echo "OK" || echo "FAILED"
echo ""
echo "=== Redis ===" && \
  docker compose exec -T redis redis-cli ping || echo "FAILED"
echo ""
echo "=== Disk Usage ===" && docker system df
echo ""
echo "=== Memory Usage ===" && docker stats --no-stream --format \
  "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

---

## 📁 Key Files Reference

| File | Purpose | When to Edit |
|------|---------|--------------|
| [`docker-compose.yml`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/docker-compose.yml) | All container definitions, ports, env vars | Change ports, add env vars, change images |
| [`nginx/templates/default.conf.template`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/nginx/templates/default.conf.template) | Nginx routing rules | Add new routes, change proxy timeouts |
| [`backend/Dockerfile`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/backend/Dockerfile) | How backend image is built | Change Go version, add system packages |
| [`frontend/Dockerfile`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/frontend/Dockerfile) | How frontend image is built | Change Node version, build args |
| [`seaweedfs/s3.json`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/seaweedfs/s3.json) | SeaweedFS S3 credentials | Change storage access key/secret |
| [`.env`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/.env.example) (on server) | All secrets & config | Change passwords, domain, ports |
| [`deploy-ubuntu.sh`](file:///c:/Users/ARMSS%20GROUPS/Documents/New%20folder/ARMSS-OTT/deploy-ubuntu.sh) | Full deploy automation | Modify deploy steps |

---

## ⚡ Cheat Sheet

```bash
# ── DAILY COMMANDS ─────────────────────────────────────────────
docker compose ps                          # status of all containers
docker compose logs -f backend             # live backend logs
docker compose logs -f frontend            # live frontend logs
docker compose restart backend             # restart one container

# ── AFTER CODE CHANGES ────────────────────────────────────────
docker compose build --no-cache frontend   # rebuild frontend
docker compose up -d frontend              # redeploy frontend only

# ── FULL REDEPLOY ─────────────────────────────────────────────
docker compose down
docker compose build --no-cache
docker compose up -d

# ── DATABASE ──────────────────────────────────────────────────
docker compose exec mysql mysql -uroot -p armss_ott   # mysql shell
docker compose exec backend wget -qO- http://localhost:8090/api/health

# ── EMERGENCY STOP ────────────────────────────────────────────
docker compose down                        # safe stop, keeps data
docker compose down -v                     # ⚠️ stop + DELETE all data

# ── DISK CLEANUP ─────────────────────────────────────────────
docker system prune -f                     # remove unused stuff
docker system df                           # show docker disk usage
```
