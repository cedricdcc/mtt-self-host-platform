-- Migration 039: Add is_shiny column to user_fishes and gacha_pull_logs
ALTER TABLE user_fishes ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gacha_pull_logs ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0;
