PRAGMA foreign_keys = ON;

CREATE TABLE terms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uri         TEXT    NOT NULL UNIQUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_id   INTEGER REFERENCES sources(source_id) ON DELETE SET NULL
);

-- term_fields: field_roles stores JSON array of roles: ['label'], ['reference'], ['translatable'], or combinations like ['label', 'translatable']
CREATE TABLE term_fields (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id       INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    field_uri     TEXT    NOT NULL,
    field_roles   TEXT    NOT NULL DEFAULT '[]' CHECK(json_valid(field_roles)),
    original_value TEXT   NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_id     INTEGER REFERENCES sources(source_id) ON DELETE SET NULL,
    UNIQUE(term_id, field_uri)
);

-- translations: Language-agnostic with 'original' status support
CREATE TABLE translations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    term_field_id  INTEGER NOT NULL REFERENCES term_fields(id) ON DELETE CASCADE,
    language       TEXT    NOT NULL DEFAULT 'undefined',
    value          TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('original', 'draft', 'review', 'approved', 'rejected', 'merged', 'discussion')),
    source         TEXT,  -- e.g. 'rdf-ingest', 'user:123', 'ai:claude-3.5', 'merged'
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    modified_at    DATETIME,
    modified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,  -- Reason for rejection when status is 'rejected'
    resubmission_motivation TEXT,  -- User's motivation/argument when resubmitting after rejection
    UNIQUE(term_field_id, language, status)
);

CREATE TABLE appeals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id  INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
    opened_by_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opened_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at       DATETIME,
    status          TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'resolved')),
    resolution      TEXT,
    UNIQUE(translation_id, status)
);

CREATE TABLE appeal_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    appeal_id   INTEGER NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT    NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    reputation  INTEGER DEFAULT 0,
    joined_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    extra       TEXT,
    is_admin    INTEGER DEFAULT 0,
    is_banned   INTEGER DEFAULT 0,
    ban_reason  TEXT
);

-- User language preferences
CREATE TABLE user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_languages TEXT NOT NULL DEFAULT '["en"]',  -- JSON array of language codes
    visible_extra_languages TEXT NOT NULL DEFAULT '[]',  -- JSON array of additional languages to show
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_translations_status ON translations(status);
CREATE INDEX idx_translations_lang   ON translations(language);
CREATE INDEX idx_translations_concept_status_lang ON translations(term_field_id, status, language);
CREATE INDEX idx_translations_source ON translations(source);
CREATE INDEX idx_appeals_status     ON appeals(status);
CREATE INDEX idx_term_fields_term_id ON term_fields(term_id);
CREATE INDEX idx_terms_source_id ON terms(source_id);
CREATE INDEX idx_term_fields_source_id ON term_fields(source_id);
CREATE INDEX idx_user_preferences_updated ON user_preferences(updated_at);

-- Generic activity / history table
CREATE TABLE user_activity (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    action        TEXT    NOT NULL,  -- e.g. 'translation_created', 'translation_approved', 'appeal_opened', etc.
    term_id           INTEGER,
    term_field_id     INTEGER,
    translation_id    INTEGER,
    appeal_id         INTEGER,
    appeal_message_id INTEGER,
    extra             TEXT,  -- JSON string recommended
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id)       REFERENCES users(id)               ON DELETE CASCADE,
    FOREIGN KEY(term_id)       REFERENCES terms(id)               ON DELETE SET NULL,
    FOREIGN KEY(term_field_id) REFERENCES term_fields(id)         ON DELETE SET NULL,
    FOREIGN KEY(translation_id)REFERENCES translations(id)        ON DELETE SET NULL,
    FOREIGN KEY(appeal_id)     REFERENCES appeals(id)             ON DELETE SET NULL,
    FOREIGN KEY(appeal_message_id) REFERENCES appeal_messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_activity_user      ON user_activity(user_id);
CREATE INDEX idx_user_activity_created   ON user_activity(created_at DESC);
CREATE INDEX idx_user_activity_action    ON user_activity(action);
CREATE INDEX idx_user_activity_user_created ON user_activity(user_id, created_at DESC);

-- Reputation history (optional)
CREATE TABLE reputation_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    delta       INTEGER NOT NULL,          -- +5, -2, etc.
    reason      TEXT NOT NULL,             -- 'translation_approved', 'appeal_spam', etc.
    related_activity_id INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(related_activity_id) REFERENCES user_activity(id) ON DELETE SET NULL
);

CREATE INDEX idx_reputation_user ON reputation_events(user_id, created_at DESC);

-- Notifications table for user notifications
CREATE TABLE notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK(type IN ('discussion_reply', 'translation_approved', 'translation_rejected')),
    translation_id  INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
    term_id         INTEGER REFERENCES terms(id) ON DELETE SET NULL,
    message         TEXT NOT NULL,
    link            TEXT,  -- URL or route to navigate to
    read            INTEGER DEFAULT 0 CHECK(read IN (0, 1)),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Discussion participants table to track who's involved in each translation discussion
CREATE TABLE discussion_participants (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id  INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(translation_id, user_id)
);

CREATE INDEX idx_discussion_participants_translation ON discussion_participants(translation_id);
CREATE INDEX idx_discussion_participants_user ON discussion_participants(user_id);

-- Sources table (maintains backward compatibility with existing code)
CREATE TABLE sources (
    source_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    source_type TEXT CHECK(source_type IN ('LDES', 'Static_file')) DEFAULT 'Static_file',
    graph_name  TEXT,
    translation_config TEXT CHECK(translation_config IS NULL OR json_valid(translation_config)),  -- JSON config for RDF type and predicate paths
    label_field_uri TEXT,  -- URI of the field used as label (e.g., http://schema.org/name)
    reference_field_uris TEXT CHECK(reference_field_uris IS NULL OR json_valid(reference_field_uris)),  -- JSON array of URIs used as reference fields
    translatable_field_uris TEXT CHECK(translatable_field_uris IS NULL OR json_valid(translatable_field_uris)),  -- JSON array of URIs that are translatable
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_path ON sources(source_path);
CREATE INDEX idx_sources_graph ON sources(graph_name);
CREATE INDEX idx_sources_type ON sources(source_type);

-- Tasks table
CREATE TABLE tasks (
    task_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type   TEXT NOT NULL CHECK(task_type IN ('file_upload', 'ldes_sync', 'ldes_feed', 'triplestore_sync', 'harvest', 'other')),
    source_id   INTEGER REFERENCES sources(source_id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    metadata    TEXT,  -- JSON metadata
    logs        TEXT,  -- Task execution logs
    error_message TEXT,  -- Error details if task failed
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by  TEXT REFERENCES users(username) ON DELETE SET NULL,
    started_at  DATETIME,
    completed_at DATETIME
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_source ON tasks(source_id);

-- Task schedulers
CREATE TABLE task_schedulers (
    scheduler_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    task_type   TEXT NOT NULL CHECK(task_type IN ('file_upload', 'ldes_sync', 'ldes_feed', 'triplestore_sync', 'harvest', 'other')),
    source_id   INTEGER REFERENCES sources(source_id) ON DELETE CASCADE,
    schedule_config TEXT NOT NULL,  -- JSON: { "type": "cron", "expression": "0 0 * * *" } or { "type": "interval", "seconds": 3600 }
    enabled     INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
    last_run    DATETIME,
    next_run    DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by  TEXT REFERENCES users(username) ON DELETE SET NULL
);

CREATE INDEX idx_task_schedulers_enabled ON task_schedulers(enabled);
CREATE INDEX idx_task_schedulers_next_run ON task_schedulers(next_run);

-- Message reports
CREATE TABLE message_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id  INTEGER NOT NULL REFERENCES appeal_messages(id) ON DELETE CASCADE,
    reported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, reported_by)
);

CREATE INDEX idx_message_reports_status ON message_reports(status);

-- Term discussions table for general term-level conversations
CREATE TABLE term_discussions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id         INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    started_by_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_term_discussions_term ON term_discussions(term_id);
CREATE INDEX idx_term_discussions_status ON term_discussions(status);

-- Term discussion messages
CREATE TABLE term_discussion_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id   INTEGER NOT NULL REFERENCES term_discussions(id) ON DELETE CASCADE,
    author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_term_discussion_messages_discussion ON term_discussion_messages(discussion_id);
CREATE INDEX idx_term_discussion_messages_created ON term_discussion_messages(created_at DESC);

-- Term discussion participants tracking
CREATE TABLE term_discussion_participants (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id       INTEGER NOT NULL REFERENCES term_discussions(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_message_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(discussion_id, user_id)
);

CREATE INDEX idx_term_discussion_participants_discussion ON term_discussion_participants(discussion_id);
CREATE INDEX idx_term_discussion_participants_user ON term_discussion_participants(user_id);

-- Auth providers for multi-provider authentication
CREATE TABLE auth_providers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         TEXT    NOT NULL, -- 'orcid', 'github', 'google', 'email', etc.
    provider_id      TEXT    NOT NULL, -- Provider-specific user ID (e.g., ORCID iD)
    email            TEXT,
    name             TEXT,
    avatar_url       TEXT,
    access_token     TEXT,
    refresh_token    TEXT,
    token_expires_at DATETIME,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_id)
);

-- User statistics table for gamification
CREATE TABLE user_stats (
    user_id         INTEGER PRIMARY KEY,
    points          INTEGER DEFAULT 0,
    daily_streak    INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    last_active_date DATE,
    translations_count INTEGER DEFAULT 0,
    reviews_count   INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_stats_points ON user_stats(points DESC);
CREATE INDEX idx_user_stats_streak ON user_stats(daily_streak DESC);

-- Daily challenges tracking
CREATE TABLE daily_challenges (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    challenge_date  DATE NOT NULL,
    challenge_type  TEXT NOT NULL CHECK(challenge_type IN ('translate_5', 'review_10', 'daily_login', 'streak_maintain')),
    target_count    INTEGER NOT NULL,
    current_count   INTEGER DEFAULT 0,
    completed       INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
    points_reward   INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, challenge_date, challenge_type)
);

CREATE INDEX idx_daily_challenges_user ON daily_challenges(user_id, challenge_date);
CREATE INDEX idx_daily_challenges_date ON daily_challenges(challenge_date);

-- Daily goals tracking table (5 translations or reviews per day)
CREATE TABLE IF NOT EXISTS user_daily_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    goal_date       DATE NOT NULL,
    target_count    INTEGER NOT NULL DEFAULT 5,
    current_count   INTEGER DEFAULT 0,
    completed       INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
    rewarded        INTEGER DEFAULT 0 CHECK(rewarded IN (0, 1)),
    completed_at    DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, goal_date)
);

CREATE INDEX idx_user_daily_goals_user ON user_daily_goals(user_id, goal_date);
CREATE INDEX idx_user_daily_goals_date ON user_daily_goals(goal_date);

-- Flow session tracking for analytics
CREATE TABLE flow_sessions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER NOT NULL,
    started_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at                DATETIME,
    translations_completed  INTEGER DEFAULT 0,
    reviews_completed       INTEGER DEFAULT 0,
    points_earned           INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_flow_sessions_user ON flow_sessions(user_id, started_at DESC);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE translations_fts USING fts5(
    value,
    language,
    content='translations',
    content_rowid='id'
);

-- FTS5 triggers
CREATE TRIGGER translations_fts_insert AFTER INSERT ON translations BEGIN
    INSERT INTO translations_fts(rowid, value, language)
    VALUES (new.id, new.value, new.language);
END;

CREATE TRIGGER translations_fts_update AFTER UPDATE ON translations BEGIN
    UPDATE translations_fts
    SET value = new.value, language = new.language
    WHERE rowid = new.id;
END;

CREATE TRIGGER translations_fts_delete AFTER DELETE ON translations BEGIN
    DELETE FROM translations_fts WHERE rowid = old.id;
END;

-- Languages table: ISO 639-1 language codes
CREATE TABLE languages (
    code        TEXT PRIMARY KEY,  -- ISO 639-1 two-letter code (e.g., 'en', 'de', 'fr')
    name        TEXT NOT NULL,     -- Full language name (e.g., 'English', 'German', 'French')
    native_name TEXT,              -- Native language name (e.g., 'English', 'Deutsch', 'Français')
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert ISO 639-1 language codes
-- Source: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
INSERT INTO languages (code, name, native_name) VALUES
('aa', 'Afar', 'Afar'),
('ab', 'Abkhazian', 'Аҧсуа'),
('ae', 'Avestan', 'Avesta'),
('af', 'Afrikaans', 'Afrikaans'),
('ak', 'Akan', 'Akan'),
('am', 'Amharic', 'አማርኛ'),
('an', 'Aragonese', 'Aragonés'),
('ar', 'Arabic', 'العربية'),
('as', 'Assamese', 'অসমীয়া'),
('av', 'Avaric', 'Авар'),
('ay', 'Aymara', 'Aymar'),
('az', 'Azerbaijani', 'Azərbaycan'),
('ba', 'Bashkir', 'Башҡорт'),
('be', 'Belarusian', 'Беларуская'),
('bg', 'Bulgarian', 'Български'),
('bh', 'Bihari languages', 'भोजपुरी'),
('bi', 'Bislama', 'Bislama'),
('bm', 'Bambara', 'Bamanankan'),
('bn', 'Bengali', 'বাংলা'),
('bo', 'Tibetan', 'བོད་ཡིག'),
('br', 'Breton', 'Brezhoneg'),
('bs', 'Bosnian', 'Bosanski'),
('ca', 'Catalan', 'Català'),
('ce', 'Chechen', 'Нохчийн'),
('ch', 'Chamorro', 'Chamoru'),
('co', 'Corsican', 'Corsu'),
('cr', 'Cree', 'ᓀᐦᐃᔭᐍᐏᐣ'),
('cs', 'Czech', 'Čeština'),
('cu', 'Church Slavic', 'Словѣньскъ'),
('cv', 'Chuvash', 'Чăваш'),
('cy', 'Welsh', 'Cymraeg'),
('da', 'Danish', 'Dansk'),
('de', 'German', 'Deutsch'),
('dv', 'Divehi', 'ދިވެހި'),
('dz', 'Dzongkha', 'རྫོང་ཁ'),
('ee', 'Ewe', 'Eʋegbe'),
('el', 'Greek', 'Ελληνικά'),
('en', 'English', 'English'),
('eo', 'Esperanto', 'Esperanto'),
('es', 'Spanish', 'Español'),
('et', 'Estonian', 'Eesti'),
('eu', 'Basque', 'Euskara'),
('fa', 'Persian', 'فارسی'),
('ff', 'Fulah', 'Fulfulde'),
('fi', 'Finnish', 'Suomi'),
('fj', 'Fijian', 'Vosa Vakaviti'),
('fo', 'Faroese', 'Føroyskt'),
('fr', 'French', 'Français'),
('fy', 'Western Frisian', 'Frysk'),
('ga', 'Irish', 'Gaeilge'),
('gd', 'Scottish Gaelic', 'Gàidhlig'),
('gl', 'Galician', 'Galego'),
('gn', 'Guarani', 'Avañe''ẽ'),
('gu', 'Gujarati', 'ગુજરાતી'),
('gv', 'Manx', 'Gaelg'),
('ha', 'Hausa', 'Hausa'),
('he', 'Hebrew', 'עברית'),
('hi', 'Hindi', 'हिन्दी'),
('ho', 'Hiri Motu', 'Hiri Motu'),
('hr', 'Croatian', 'Hrvatski'),
('ht', 'Haitian', 'Kreyòl ayisyen'),
('hu', 'Hungarian', 'Magyar'),
('hy', 'Armenian', 'Հայերեն'),
('hz', 'Herero', 'Otjiherero'),
('ia', 'Interlingua', 'Interlingua'),
('id', 'Indonesian', 'Bahasa Indonesia'),
('ie', 'Interlingue', 'Interlingue'),
('ig', 'Igbo', 'Igbo'),
('ii', 'Sichuan Yi', 'ꆈꌠꉙ'),
('ik', 'Inupiaq', 'Iñupiaq'),
('io', 'Ido', 'Ido'),
('is', 'Icelandic', 'Íslenska'),
('it', 'Italian', 'Italiano'),
('iu', 'Inuktitut', 'ᐃᓄᒃᑎᑐᑦ'),
('ja', 'Japanese', '日本語'),
('jv', 'Javanese', 'Basa Jawa'),
('ka', 'Georgian', 'ქართული'),
('kg', 'Kongo', 'Kikongo'),
('ki', 'Kikuyu', 'Gĩkũyũ'),
('kj', 'Kuanyama', 'Kuanyama'),
('kk', 'Kazakh', 'Қазақ'),
('kl', 'Kalaallisut', 'Kalaallisut'),
('km', 'Khmer', 'ភាសាខ្មែរ'),
('kn', 'Kannada', 'ಕನ್ನಡ'),
('ko', 'Korean', '한국어'),
('kr', 'Kanuri', 'Kanuri'),
('ks', 'Kashmiri', 'कश्मीरी'),
('ku', 'Kurdish', 'Kurdî'),
('kv', 'Komi', 'Коми'),
('kw', 'Cornish', 'Kernewek'),
('ky', 'Kirghiz', 'Кыргызча'),
('la', 'Latin', 'Latina'),
('lb', 'Luxembourgish', 'Lëtzebuergesch'),
('lg', 'Ganda', 'Luganda'),
('li', 'Limburgan', 'Limburgs'),
('ln', 'Lingala', 'Lingála'),
('lo', 'Lao', 'ລາວ'),
('lt', 'Lithuanian', 'Lietuvių'),
('lu', 'Luba-Katanga', 'Kiluba'),
('lv', 'Latvian', 'Latviešu'),
('mg', 'Malagasy', 'Malagasy'),
('mh', 'Marshallese', 'Kajin M̧ajeļ'),
('mi', 'Maori', 'Māori'),
('mk', 'Macedonian', 'Македонски'),
('ml', 'Malayalam', 'മലയാളം'),
('mn', 'Mongolian', 'Монгол'),
('mr', 'Marathi', 'मराठी'),
('ms', 'Malay', 'Bahasa Melayu'),
('mt', 'Maltese', 'Malti'),
('my', 'Burmese', 'မြန်မာဘာသာ'),
('na', 'Nauru', 'Dorerin Naoero'),
('nb', 'Norwegian Bokmål', 'Norsk bokmål'),
('nd', 'North Ndebele', 'isiNdebele'),
('ne', 'Nepali', 'नेपाली'),
('ng', 'Ndonga', 'Owambo'),
('nl', 'Dutch', 'Nederlands'),
('nn', 'Norwegian Nynorsk', 'Norsk nynorsk'),
('no', 'Norwegian', 'Norsk'),
('nr', 'South Ndebele', 'isiNdebele'),
('nv', 'Navajo', 'Diné bizaad'),
('ny', 'Chichewa', 'Chichewa'),
('oc', 'Occitan', 'Occitan'),
('oj', 'Ojibwa', 'ᐊᓂᔑᓈᐯᒧᐎᓐ'),
('om', 'Oromo', 'Afaan Oromoo'),
('or', 'Oriya', 'ଓଡ଼ିଆ'),
('os', 'Ossetian', 'Ирон'),
('pa', 'Punjabi', 'ਪੰਜਾਬੀ'),
('pi', 'Pali', 'पालि'),
('pl', 'Polish', 'Polski'),
('ps', 'Pashto', 'پښتو'),
('pt', 'Portuguese', 'Português'),
('qu', 'Quechua', 'Runa Simi'),
('rm', 'Romansh', 'Rumantsch'),
('rn', 'Rundi', 'Ikirundi'),
('ro', 'Romanian', 'Română'),
('ru', 'Russian', 'Русский'),
('rw', 'Kinyarwanda', 'Kinyarwanda'),
('sa', 'Sanskrit', 'संस्कृतम्'),
('sc', 'Sardinian', 'Sardu'),
('sd', 'Sindhi', 'सिन्धी'),
('se', 'Northern Sami', 'Davvisámegiella'),
('sg', 'Sango', 'Sängö'),
('si', 'Sinhala', 'සිංහල'),
('sk', 'Slovak', 'Slovenčina'),
('sl', 'Slovenian', 'Slovenščina'),
('sm', 'Samoan', 'Gagana Samoa'),
('sn', 'Shona', 'chiShona'),
('so', 'Somali', 'Soomaali'),
('sq', 'Albanian', 'Shqip'),
('sr', 'Serbian', 'Српски'),
('ss', 'Swati', 'SiSwati'),
('st', 'Southern Sotho', 'Sesotho'),
('su', 'Sundanese', 'Basa Sunda'),
('sv', 'Swedish', 'Svenska'),
('sw', 'Swahili', 'Kiswahili'),
('ta', 'Tamil', 'தமிழ்'),
('te', 'Telugu', 'తెలుగు'),
('tg', 'Tajik', 'Тоҷикӣ'),
('th', 'Thai', 'ไทย'),
('ti', 'Tigrinya', 'ትግርኛ'),
('tk', 'Turkmen', 'Türkmençe'),
('tl', 'Tagalog', 'Tagalog'),
('tn', 'Tswana', 'Setswana'),
('to', 'Tonga', 'Lea fakatonga'),
('tr', 'Turkish', 'Türkçe'),
('ts', 'Tsonga', 'Xitsonga'),
('tt', 'Tatar', 'Татарча'),
('tw', 'Twi', 'Twi'),
('ty', 'Tahitian', 'Reo Tahiti'),
('ug', 'Uighur', 'ئۇيغۇرچە'),
('uk', 'Ukrainian', 'Українська'),
('ur', 'Urdu', 'اردو'),
('uz', 'Uzbek', 'Oʻzbek'),
('ve', 'Venda', 'Tshivenḓa'),
('vi', 'Vietnamese', 'Tiếng Việt'),
('vo', 'Volapük', 'Volapük'),
('wa', 'Walloon', 'Walon'),
('wo', 'Wolof', 'Wollof'),
('xh', 'Xhosa', 'isiXhosa'),
('yi', 'Yiddish', 'ייִדיש'),
('yo', 'Yoruba', 'Yorùbá'),
('za', 'Zhuang', 'Saɯ cueŋƅ'),
('zh', 'Chinese', '中文'),
('zu', 'Zulu', 'isiZulu');

CREATE INDEX idx_languages_name ON languages(name);

-- View for term summary
CREATE VIEW term_summary AS
SELECT 
    t.id as term_id,
    t.uri,
    tf.id as term_field_id,
    tf.field_uri,
    tf.original_value,
    tr.id as translation_id,
    tr.language,
    tr.status,
    tr.value as translation_value,
    tr.source
FROM terms t
LEFT JOIN term_fields tf ON t.id = tf.term_id
LEFT JOIN translations tr ON tf.id = tr.term_field_id;

-- Communities Feature: User-managed communities and language communities

-- Communities table
CREATE TABLE communities (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    description         TEXT,
    type                TEXT NOT NULL CHECK(type IN ('language', 'user_created')),
    access_type         TEXT NOT NULL DEFAULT 'open' CHECK(access_type IN ('open', 'invite_only')),
    language_code       TEXT,  -- For language communities, references languages(code)
    owner_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL for language communities
    member_count        INTEGER DEFAULT 0,  -- Cached member count
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(language_code) REFERENCES languages(code) ON DELETE CASCADE
);

CREATE INDEX idx_communities_type ON communities(type);
CREATE INDEX idx_communities_owner ON communities(owner_id);
CREATE INDEX idx_communities_language ON communities(language_code);

-- Community members table
CREATE TABLE community_members (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id        INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('creator', 'moderator', 'member')),
    joined_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_role ON community_members(community_id, role);

-- Community invitations table
CREATE TABLE community_invitations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id        INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at        DATETIME
);

CREATE INDEX idx_community_invitations_user ON community_invitations(user_id, status);
CREATE INDEX idx_community_invitations_community ON community_invitations(community_id, status);
-- Unique index to prevent multiple pending invitations for same user in same community
-- Allows re-invitation after decline
CREATE UNIQUE INDEX idx_community_invitations_unique_pending 
ON community_invitations(community_id, user_id) 
WHERE status = 'pending';

-- Community Goals Feature
-- Allows admins to create and manage community-wide translation goals

CREATE TABLE community_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    goal_type       TEXT NOT NULL CHECK(goal_type IN ('translation_count', 'collection')),
    target_count    INTEGER,  -- Number of translations or terms to complete
    target_language TEXT,  -- Language code for translations (e.g., 'fr', 'nl')
    collection_id   INTEGER REFERENCES sources(source_id) ON DELETE CASCADE,  -- If goal is for a specific collection/source
    community_id    INTEGER REFERENCES communities(id) ON DELETE CASCADE,  -- If goal is for a specific community
    is_recurring    INTEGER DEFAULT 0 CHECK(is_recurring IN (0, 1)),  -- Is this a recurring goal?
    recurrence_type TEXT CHECK(recurrence_type IN ('daily', 'weekly', 'monthly') OR recurrence_type IS NULL),  -- Type of recurrence
    start_date      DATETIME NOT NULL,
    end_date        DATETIME,  -- NULL for infinite recurring goals
    is_active       INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_by_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_goals_active ON community_goals(is_active);
CREATE INDEX idx_community_goals_language ON community_goals(target_language);
CREATE INDEX idx_community_goals_dates ON community_goals(start_date, end_date);
CREATE INDEX idx_community_goals_community ON community_goals(community_id);

-- Track user dismissals of goal widgets
CREATE TABLE community_goal_dismissals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id         INTEGER NOT NULL REFERENCES community_goals(id) ON DELETE CASCADE,
    dismissed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, goal_id)
);

CREATE INDEX idx_community_goal_dismissals_user ON community_goal_dismissals(user_id);

-- Link admin goals to language communities (many-to-many)
CREATE TABLE community_goal_links (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id         INTEGER NOT NULL REFERENCES community_goals(id) ON DELETE CASCADE,
    community_id    INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(goal_id, community_id)
);

CREATE INDEX idx_community_goal_links_goal ON community_goal_links(goal_id);
CREATE INDEX idx_community_goal_links_community ON community_goal_links(community_id);

-- Community Reports
-- Allows users to report offensive or inappropriate communities

CREATE TABLE community_reports (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id        INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    reported_by_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason              TEXT NOT NULL CHECK(reason IN ('offensive', 'spam', 'inappropriate', 'harassment', 'other')),
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    reviewed_by_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         DATETIME,
    resolution_notes    TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, reported_by_id, status)
);

CREATE INDEX idx_community_reports_community ON community_reports(community_id);
CREATE INDEX idx_community_reports_status ON community_reports(status);
CREATE INDEX idx_community_reports_reported_by ON community_reports(reported_by_id);

-- Vocabulary Requests
-- Allows users to request new vocabularies and LDES feeds to be imported
CREATE TABLE vocabulary_requests (
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

CREATE INDEX idx_vocabulary_requests_status ON vocabulary_requests(status);
CREATE INDEX idx_vocabulary_requests_user ON vocabulary_requests(requested_by_id);

