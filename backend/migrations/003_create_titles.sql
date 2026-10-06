-- ============================================================
-- Migration: 003_create_titles.sql
-- Description: Creates the content catalog (titles) table.
--              Stores movies, series, live channels, documentaries.
--              Genres and badges are stored as JSON arrays (TEXT).
-- Author: ARMSS-OTT
-- Date: 2024-01-01
-- ============================================================

CREATE TABLE IF NOT EXISTS titles (
    id            VARCHAR(100) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    kind          VARCHAR(50)  NOT NULL
                  COMMENT 'Content type: film, series, live, documentary',
    year          INT          NOT NULL
                  COMMENT 'Release year',
    maturity      VARCHAR(20)  NOT NULL
                  COMMENT 'Age rating: G, PG, 12, 15, 18, U/A',
    runtime_min   INT          NOT NULL
                  COMMENT 'Duration in minutes (for live use 0)',
    match_percent INT          NOT NULL DEFAULT 0
                  COMMENT 'Personalization match score 0-100',
    logline       TEXT         NOT NULL
                  COMMENT 'Short one-line description',
    synopsis      TEXT         NOT NULL
                  COMMENT 'Full description paragraph',
    poster        TEXT         NOT NULL
                  COMMENT 'Poster image URL (portrait, 2:3 ratio)',
    backdrop      TEXT         NOT NULL
                  COMMENT 'Backdrop/hero image URL (16:9 ratio)',
    trailer       TEXT             NULL
                  COMMENT 'Trailer video URL or embed ID (optional)',
    tone          VARCHAR(50)  NOT NULL
                  COMMENT 'Mood/tone tag: action, drama, comedy, thriller, etc.',
    original      BOOLEAN      NOT NULL DEFAULT FALSE
                  COMMENT 'TRUE if ARMSS Original content',
    kids          BOOLEAN      NOT NULL DEFAULT FALSE
                  COMMENT 'TRUE if appropriate for Kids profiles',
    required_tier VARCHAR(50)  NOT NULL DEFAULT 'free'
                  COMMENT 'Minimum subscription tier: free, standard, premium',
    genres        TEXT         NOT NULL
                  COMMENT 'JSON array of genre strings e.g. ["Action","Drama"]',
    badges        TEXT         NOT NULL
                  COMMENT 'JSON array of badge labels e.g. ["4K","HDR","Dolby"]',

    PRIMARY KEY (id),
    KEY idx_titles_kind (kind),
    KEY idx_titles_tier (required_tier),
    KEY idx_titles_kids (kids),
    KEY idx_titles_original (original),
    KEY idx_titles_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Content catalog — movies, series, live TV, documentaries';
