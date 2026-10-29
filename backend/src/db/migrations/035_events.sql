-- 035_events.sql: Migration for Events & Competitions feature

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    source_id INTEGER REFERENCES sources(source_id) ON DELETE SET NULL,
    target_language TEXT DEFAULT 'all',
    target_count INTEGER DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK(status IN ('UPCOMING', 'ACTIVE', 'ENDED', 'CANCELLED')),
    has_teams INTEGER NOT NULL DEFAULT 1 CHECK(has_teams IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_teams (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT,
    join_code TEXT NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_memberships (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_event_membership 
ON event_memberships (event_id, user_id) 
WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS event_contributions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id TEXT REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    translation_id INTEGER REFERENCES translations(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('TRANSLATION_CREATED', 'TRANSLATION_APPROVED', 'VOTE_CAST')),
    points INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_rewards (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL DEFAULT 'TITLE' CHECK(reward_type IN ('TITLE', 'BADGE', 'POINTS')),
    name TEXT NOT NULL,
    metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS user_rewards (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL REFERENCES event_rewards(id) ON DELETE CASCADE,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_equipped INTEGER NOT NULL DEFAULT 0 CHECK(is_equipped IN (0, 1))
);

CREATE TABLE IF NOT EXISTS user_email_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    event_emails_enabled INTEGER NOT NULL DEFAULT 1 CHECK(event_emails_enabled IN (0, 1)),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
