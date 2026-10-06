-- ============================================================
-- Migration: 001_create_users_table.sql
-- Description: Creates the core users table with subscription tiers,
--              admin flag, and login/activity timestamps.
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id               VARCHAR(64)  NOT NULL,
    email            VARCHAR(191) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'
                     COMMENT 'Allowed values: free, standard, premium, banned',
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
  COMMENT='Core user accounts table';
