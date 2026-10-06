-- ============================================================
-- Migration: 007_create_user_activity_logs.sql
-- Description: Creates the activity logs table — records all user
--              actions (login, watch, upgrade, etc.) for analytics.
--              Used by the admin dashboard for DAU/WAU/MAU counts,
--              daily trends, and user drilldown.
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id         VARCHAR(64)  NOT NULL,
    user_id    VARCHAR(64)  NOT NULL,
    action     VARCHAR(50)  NOT NULL
               COMMENT 'Action type: login, watch, upgrade, cancel, google_login',
    details    VARCHAR(255)          DEFAULT ''
               COMMENT 'Context detail e.g. title_id, old_tier -> new_tier',
    created_at DATETIME     NOT NULL,

    PRIMARY KEY (id),
    KEY idx_activity_user_date (user_id, created_at),
    KEY idx_activity_date (created_at),
    KEY idx_activity_action (action),
    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log of all user actions — powers admin analytics dashboard';
