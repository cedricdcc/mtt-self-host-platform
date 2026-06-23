-- Create vocabulary_requests table
CREATE TABLE IF NOT EXISTS vocabulary_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    source_uri      TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed')),
    requested_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_notes     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_requests_status ON vocabulary_requests(status);
CREATE INDEX IF NOT EXISTS idx_vocabulary_requests_user ON vocabulary_requests(requested_by_id);
