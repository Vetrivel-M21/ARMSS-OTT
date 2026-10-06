-- ============================================================
-- Migration: 002_create_profiles.sql
-- Description: Creates user profiles table. Each user account can
--              have multiple viewing profiles (adult + kids).
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id           VARCHAR(64) NOT NULL,
    user_id      VARCHAR(64) NOT NULL,
    name         VARCHAR(50) NOT NULL,
    avatar_color VARCHAR(30) NOT NULL  COMMENT 'e.g. marble, moss, coral, ocean',
    is_kids      BOOLEAN     NOT NULL DEFAULT FALSE
                 COMMENT 'If TRUE, profile is a Kids profile with content restrictions',
    pin          VARCHAR(10)          DEFAULT ''
                 COMMENT 'Optional 4-digit PIN to lock this profile',
    created_at   DATETIME    NOT NULL,

    PRIMARY KEY (id),
    KEY idx_profiles_user (user_id),
    CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Viewing profiles under a user account (Netflix-style multi-profile)';
