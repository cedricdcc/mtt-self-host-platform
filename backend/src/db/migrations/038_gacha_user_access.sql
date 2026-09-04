-- Migration 038: Add user access control flag to user_ecosystem
ALTER TABLE user_ecosystem ADD COLUMN has_gacha_access INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_user_ecosystem_access ON user_ecosystem(has_gacha_access);
