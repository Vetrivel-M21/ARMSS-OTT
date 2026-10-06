# ARMSS-OTT Database Migrations

MySQL migration files for the ARMSS-OTT backend.
Credentials: `root / Vetri@123` → Database: `armss_ott`

---

## File Structure

```
migrations/
├── 000_full_schema.sql      ← Run this on a fresh DB (all tables at once)
├── 000_drop_all.sql         ← ⚠️ Drops all tables (dev reset only!)
├── 001_create_users.sql
├── 002_create_profiles.sql
├── 003_create_titles.sql
├── 004_create_watchlist.sql
├── 005_create_watch_progress.sql
├── 006_create_ratings.sql
└── 007_create_user_activity_logs.sql
```

---

## Tables Overview

| # | Table | Description |
|---|-------|-------------|
| 1 | `users` | Core accounts — email, password, subscription tier, admin flag |
| 2 | `profiles` | Per-user viewing profiles (adult + kids) |
| 3 | `titles` | Content catalog — films, series, live TV, documentaries |
| 4 | `watchlist` | My List — per-profile saved titles |
| 5 | `watch_progress` | Playback position for resume-watching (heartbeat ~30s) |
| 6 | `ratings` | Thumbs up/down ratings per user per title |
| 7 | `user_activity_logs` | Audit log for all actions — powers admin analytics |

---

## How to Run

### Option A — Fresh Database (Recommended)
```bash
# Create the database first (if it doesn't exist)
mysql -u root -pVetri@123 -e "CREATE DATABASE IF NOT EXISTS armss_ott CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run full schema
mysql -u root -pVetri@123 armss_ott < migrations/000_full_schema.sql
```

### Option B — Run Individual Migrations (Step by Step)
```bash
mysql -u root -pVetri@123 armss_ott < migrations/001_create_users.sql
mysql -u root -pVetri@123 armss_ott < migrations/002_create_profiles.sql
mysql -u root -pVetri@123 armss_ott < migrations/003_create_titles.sql
mysql -u root -pVetri@123 armss_ott < migrations/004_create_watchlist.sql
mysql -u root -pVetri@123 armss_ott < migrations/005_create_watch_progress.sql
mysql -u root -pVetri@123 armss_ott < migrations/006_create_ratings.sql
mysql -u root -pVetri@123 armss_ott < migrations/007_create_user_activity_logs.sql
```

### Option C — Drop and Reset (⚠️ Dev Only!)
```bash
mysql -u root -pVetri@123 armss_ott < migrations/000_drop_all.sql
mysql -u root -pVetri@123 armss_ott < migrations/000_full_schema.sql
```

### Windows PowerShell Path
```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root "-pVetri@123" armss_ott -e "source migrations/000_full_schema.sql"
```

---

## Notes

- All tables use `InnoDB` engine with `utf8mb4_unicode_ci` charset (full Unicode + emoji support)
- All foreign keys cascade on `DELETE` — deleting a user removes all their profiles, watchlist, progress, ratings, and activity logs
- The Go backend auto-runs `CREATE TABLE IF NOT EXISTS` on startup via `database/db.go` — these migration files are for **explicit database management**, documentation, and version control
- `genres` and `badges` in the `titles` table are stored as JSON arrays in `TEXT` columns (e.g. `["Action","Drama"]`)
