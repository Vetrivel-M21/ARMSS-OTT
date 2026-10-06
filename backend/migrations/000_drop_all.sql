-- ============================================================
-- Rollback: 000_drop_all.sql
-- Description: Drops ALL ARMSS-OTT tables in reverse dependency
--              order (children first, parents last).
--
-- ⚠️  WARNING: This is DESTRUCTIVE and will delete ALL data!
--              Only run in development / testing environments.
--
-- Run:  mysql -u root -p armss_ott < migrations/000_drop_all.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS user_activity_logs;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS watch_progress;
DROP TABLE IF EXISTS watchlist;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'ARMSS-OTT: all tables dropped.' AS status;
