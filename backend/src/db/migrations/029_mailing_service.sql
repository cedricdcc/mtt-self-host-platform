-- Migration: 029_mailing_service
-- Add email fields to users
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0 CHECK(email_verified IN (0, 1));

-- Add mailing preference columns to user_preferences
ALTER TABLE user_preferences ADD COLUMN email_on_discussion INTEGER DEFAULT 1 CHECK(email_on_discussion IN (0, 1));
ALTER TABLE user_preferences ADD COLUMN email_on_status_change INTEGER DEFAULT 1 CHECK(email_on_status_change IN (0, 1));
ALTER TABLE user_preferences ADD COLUMN email_digest_frequency TEXT DEFAULT 'none' CHECK(email_digest_frequency IN ('none', 'daily', 'weekly'));

-- Create mail_queue table
CREATE TABLE IF NOT EXISTS mail_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email        TEXT NOT NULL,
    subject         TEXT NOT NULL,
    body_html       TEXT,
    body_text       TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'sent', 'failed')),
    attempts        INTEGER DEFAULT 0,
    last_error      TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at    DATETIME
);

-- Index for queue performance
CREATE INDEX IF NOT EXISTS idx_mail_queue_status ON mail_queue(status);
