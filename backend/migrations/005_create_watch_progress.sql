-- ============================================================
-- Migration: 005_create_watch_progress.sql
-- Description: Creates the watch_progress table — stores per-title
--              playback position for resume-watching. Updated on every
--              heartbeat (every ~30 seconds during playback).
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS watch_progress (
    user_id          VARCHAR(64)  NOT NULL,
    profile_id       VARCHAR(64)  NOT NULL,
    title_id         VARCHAR(100) NOT NULL,
    episode_id       VARCHAR(100)          DEFAULT ''
                     COMMENT 'Series episode ID — empty for films',
    progress_percent DOUBLE       NOT NULL DEFAULT 0
                     COMMENT 'Playback progress 0.0–100.0',
    time_seconds     DOUBLE       NOT NULL DEFAULT 0
                     COMMENT 'Playback position in seconds',
    updated_at       DATETIME     NOT NULL
                     COMMENT 'Timestamp of last heartbeat',

    PRIMARY KEY (user_id, profile_id, title_id),
    KEY idx_wp_user_profile (user_id, profile_id),
    KEY idx_wp_updated (updated_at),
    KEY idx_wp_progress (progress_percent),
    CONSTRAINT fk_wp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wp_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Playback progress for resume-watching — updated every ~30s heartbeat';
