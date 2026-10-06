-- ============================================================
-- Migration: 000_full_schema.sql
-- Description: ARMSS-OTT complete database schema — all tables in
--              dependency order. Run this on a fresh database to
--              bootstrap the entire structure in one shot.
--
-- Run:  mysql -u root -p armss_ott < migrations/000_full_schema.sql
--
-- Individual numbered migrations (001–007) are also available
-- for step-by-step migration tracking.
-- ============================================================

-- Safety check: ensure we are on the correct database
-- SELECT DATABASE();  -- Uncomment to verify

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+05:30';

-- ─── 1. USERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id               VARCHAR(64)  NOT NULL,
    email            VARCHAR(191) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL        COMMENT 'bcrypt hash, cost=10',
    name             VARCHAR(100) NOT NULL,
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'
                     COMMENT 'free | standard | premium | banned',
    is_admin         BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at    DATETIME     NULL     DEFAULT NULL,
    last_active_at   DATETIME     NULL     DEFAULT NULL,
    created_at       DATETIME     NOT NULL,
    updated_at       DATETIME     NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_tier (subscription_tier),
    KEY idx_users_admin (is_admin),
    KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Core user accounts';

-- ─── 2. PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id           VARCHAR(64) NOT NULL,
    user_id      VARCHAR(64) NOT NULL,
    name         VARCHAR(50) NOT NULL,
    avatar_color VARCHAR(30) NOT NULL  COMMENT 'marble | moss | coral | ocean | gold',
    is_kids      BOOLEAN     NOT NULL DEFAULT FALSE,
    pin          VARCHAR(10)          DEFAULT '',
    created_at   DATETIME    NOT NULL,

    PRIMARY KEY (id),
    KEY idx_profiles_user (user_id),
    CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-user viewing profiles (Netflix-style multi-profile)';

-- ─── 3. TITLES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS titles (
    id            VARCHAR(100) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    kind          VARCHAR(50)  NOT NULL    COMMENT 'film | series | live | documentary',
    year          INT          NOT NULL,
    maturity      VARCHAR(20)  NOT NULL    COMMENT 'G | PG | U/A | 12 | 15 | 18',
    runtime_min   INT          NOT NULL    COMMENT 'Duration in minutes (0 for live)',
    match_percent INT          NOT NULL DEFAULT 0 COMMENT '0-100 personalization score',
    logline       TEXT         NOT NULL    COMMENT 'One-line description',
    synopsis      TEXT         NOT NULL    COMMENT 'Full description',
    poster        TEXT         NOT NULL    COMMENT 'Portrait poster URL (2:3)',
    backdrop      TEXT         NOT NULL    COMMENT 'Landscape hero image URL (16:9)',
    trailer       TEXT             NULL    COMMENT 'Trailer video URL (optional)',
    tone          VARCHAR(50)  NOT NULL    COMMENT 'action | drama | comedy | thriller | romance',
    original      BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'ARMSS Original content',
    kids          BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'Kids-safe content',
    required_tier VARCHAR(50)  NOT NULL DEFAULT 'free' COMMENT 'free | standard | premium',
    genres        TEXT         NOT NULL    COMMENT 'JSON array: ["Action","Drama"]',
    badges        TEXT         NOT NULL    COMMENT 'JSON array: ["4K","HDR","Dolby Atmos"]',

    PRIMARY KEY (id),
    KEY idx_titles_kind (kind),
    KEY idx_titles_tier (required_tier),
    KEY idx_titles_kids (kids),
    KEY idx_titles_original (original),
    KEY idx_titles_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Content catalog: movies, series, live TV, documentaries';

-- ─── 4. WATCHLIST ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    user_id    VARCHAR(64)  NOT NULL,
    profile_id VARCHAR(64)  NOT NULL,
    title_id   VARCHAR(100) NOT NULL,
    added_at   DATETIME     NOT NULL,

    PRIMARY KEY (user_id, profile_id, title_id),
    KEY idx_watchlist_user_profile (user_id, profile_id),
    KEY idx_watchlist_added (added_at),
    CONSTRAINT fk_watchlist_user
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_watchlist_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='My List — per-profile saved titles';

-- ─── 5. WATCH PROGRESS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_progress (
    user_id          VARCHAR(64)  NOT NULL,
    profile_id       VARCHAR(64)  NOT NULL,
    title_id         VARCHAR(100) NOT NULL,
    episode_id       VARCHAR(100)          DEFAULT '' COMMENT 'Series episode ID (empty for films)',
    progress_percent DOUBLE       NOT NULL DEFAULT 0  COMMENT '0.0–100.0',
    time_seconds     DOUBLE       NOT NULL DEFAULT 0  COMMENT 'Playback position in seconds',
    updated_at       DATETIME     NOT NULL             COMMENT 'Last heartbeat timestamp',

    PRIMARY KEY (user_id, profile_id, title_id),
    KEY idx_wp_user_profile (user_id, profile_id),
    KEY idx_wp_updated (updated_at),
    KEY idx_wp_progress (progress_percent),
    CONSTRAINT fk_wp_user
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_wp_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Playback progress for resume-watching (heartbeat every ~30s)';

-- ─── 6. RATINGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
    user_id    VARCHAR(64)  NOT NULL,
    title_id   VARCHAR(100) NOT NULL,
    score      TINYINT      NOT NULL  COMMENT '1 = Thumbs Up, -1 = Thumbs Down',
    updated_at DATETIME     NOT NULL,

    PRIMARY KEY (user_id, title_id),
    KEY idx_ratings_title (title_id),
    KEY idx_ratings_score (score),
    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_ratings_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE,
    CONSTRAINT chk_ratings_score CHECK (score IN (-1, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thumbs up/down ratings per user per title';

-- ─── 7. USER ACTIVITY LOGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id         VARCHAR(64)  NOT NULL,
    user_id    VARCHAR(64)  NOT NULL,
    action     VARCHAR(50)  NOT NULL  COMMENT 'login | watch | upgrade | cancel | google_login',
    details    VARCHAR(255)           DEFAULT '' COMMENT 'Extra context e.g. title_id',
    created_at DATETIME     NOT NULL,

    PRIMARY KEY (id),
    KEY idx_activity_user_date (user_id, created_at),
    KEY idx_activity_date (created_at),
    KEY idx_activity_action (action),
    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log of all user actions — powers admin analytics dashboard';

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Tables created: users, profiles, titles, watchlist, watch_progress,
--                 ratings, user_activity_logs
SELECT 'ARMSS-OTT schema migration complete!' AS status;
