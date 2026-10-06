-- ============================================================
-- Migration: 006_create_ratings.sql
-- Description: Creates the ratings table — stores thumbs up/down
--              ratings per user per title.
--              score:  1 = Thumbs Up
--              score: -1 = Thumbs Down
--              (delete the row to clear rating)
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
    user_id    VARCHAR(64)  NOT NULL,
    title_id   VARCHAR(100) NOT NULL,
    score      TINYINT      NOT NULL
               COMMENT '1 = Thumbs Up, -1 = Thumbs Down',
    updated_at DATETIME     NOT NULL,

    PRIMARY KEY (user_id, title_id),
    KEY idx_ratings_title (title_id),
    KEY idx_ratings_score (score),
    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ratings_title
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE,
    CONSTRAINT chk_ratings_score CHECK (score IN (-1, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='User thumbs up/down ratings per title';
