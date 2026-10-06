-- ============================================================
-- Migration: 004_create_watchlist.sql
-- Description: Creates the watchlist table — stores titles that
--              a user has added to their "My List" per profile.
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS watchlist (
    user_id    VARCHAR(64)  NOT NULL,
    profile_id VARCHAR(64)  NOT NULL,
    title_id   VARCHAR(100) NOT NULL,
    added_at   DATETIME     NOT NULL,

    PRIMARY KEY (user_id, profile_id, title_id),
    KEY idx_watchlist_user_profile (user_id, profile_id),
    KEY idx_watchlist_added (added_at),
    CONSTRAINT fk_watchlist_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_watchlist_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='User watchlist (My List) — per profile saved titles';
