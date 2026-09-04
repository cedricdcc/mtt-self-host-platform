// Database initialization service - handles database creation on startup

const fs = require("fs");
const path = require("path");
const config = require("../config");
const { isDatabaseInitialized, applySchema, getDatabase } = require("../db/database");
const { initializeLanguageCommunities } = require("./community.service");

function columnExists(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some(column => column.name === columnName);
}

function tableExists(db, tableName) {
  const table = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
  return !!table;
}

function indexExists(db, indexName) {
  const index = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get(indexName);
  return !!index;
}

function shouldIgnoreMigrationError(db, filename, err) {
  if (filename === '019_rejection_reason.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'translations', 'rejection_reason');
  }

  if (filename === '020_communities.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'community_goals', 'community_id');
  }

  if (filename === '025_resubmission_motivation.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'translations', 'resubmission_motivation');
  }

  if (filename === '026_notifications_and_discussion.sql' && /already exists/i.test(err.message)) {
    // Check if the notifications and discussion_participants tables exist
    // If they do, the migration has already been applied
    return tableExists(db, 'notifications') && tableExists(db, 'discussion_participants');
  }

  if (filename === '033_has_seen_onboarding.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'user_preferences', 'has_seen_onboarding');
  }

  if (filename === '034_message_reports_admin_notes.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'message_reports', 'admin_notes');
  }

  if (filename === '038_gacha_user_access.sql' && /duplicate column name/i.test(err.message)) {
    return columnExists(db, 'user_ecosystem', 'has_gacha_access');
  }

  return false;
}

/**
 * Ensure the database directory exists
 */
function ensureDatabaseDirectory() {
  if (!config.translations.dbPath) {
    throw new Error('SQLITE_DB_PATH environment variable is not set');
  }

  const dbDir = path.dirname(config.translations.dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[DB Init] Created database directory: ${dbDir}`);
  }
}

/**
 * Check if database file exists
 * @returns {boolean} True if database file exists
 */
function databaseFileExists() {
  return fs.existsSync(config.translations.dbPath);
}

/**
 * Apply all migrations that haven't been applied yet
 */
function applyMigrations() {
  const db = getDatabase();
  const migrationsDir = path.join(__dirname, '../db/migrations');
  
  // Create migrations_applied table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Get list of migration files (excluding schema.sql)
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f !== 'schema.sql')
    .sort();
  
  console.log(`[DB Init] Found ${migrationFiles.length} migration file(s)`);
  
  // Apply each migration
  migrationFiles.forEach(filename => {
    const migrationName = filename.replace('.sql', '');
    
    // Check if migration has been applied
    const applied = db.prepare(
      "SELECT migration_name FROM migrations_applied WHERE migration_name = ?"
    ).get(migrationName);
    
    if (applied) {
      console.log(`[DB Init] Migration ${filename} already applied, skipping`);
      return;
    }
    
    console.log(`[DB Init] Applying migration: ${filename}`);
    const migrationPath = path.join(migrationsDir, filename);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    try {
      db.exec(migrationSQL);

      // Record that this migration has been applied
      db.prepare(
        "INSERT INTO migrations_applied (migration_name) VALUES (?)"
      ).run(migrationName);

      console.log(`[DB Init] ✓ Migration ${filename} applied successfully`);
    } catch (err) {
      if (shouldIgnoreMigrationError(db, filename, err)) {
        console.warn(`[DB Init] Migration ${filename} already applied, marking as applied`);
        db.prepare(
          "INSERT INTO migrations_applied (migration_name) VALUES (?)"
        ).run(migrationName);
        return;
      }

      console.error(`[DB Init] ERROR applying migration ${filename}:`, err.message);
      throw err;
    }
  });
}

/**
 * Initialize the database with schema if it doesn't exist or is uninitialized
 */
function initializeDatabase() {
  ensureDatabaseDirectory();

  const dbExists = databaseFileExists();
  
  if (!dbExists) {
    console.log(`[DB Init] Database file not found at ${config.translations.dbPath}`);
    console.log('[DB Init] Creating new database...');
  }

  // Get database instance (creates file if doesn't exist)
  const db = getDatabase();


  // Check if schema has been applied
  if (!isDatabaseInitialized()) {
    console.log('[DB Init] Database schema not initialized');
    console.log('[DB Init] Applying schema from migrations/schema.sql...');
    applySchema();
    console.log('[DB Init] ✓ Database schema applied successfully');
  } else {
    console.log('[DB Init] ✓ Database already initialized');
  }
  
  // Apply any pending migrations
  console.log('[DB Init] Checking for migrations...');
  applyMigrations();

  // Ensure users with is_admin or is_superadmin in extra have is_admin = 1 in database column
  try {
    db.prepare(`
      UPDATE users 
      SET is_admin = 1 
      WHERE is_admin = 0 AND (extra LIKE '%"is_admin":true%' OR extra LIKE '%"is_superadmin":true%')
    `).run();
  } catch (err) {
    console.error('[DB Init] Error syncing admin flags:', err);
  }
  
  seedAchievements(db);
  retroactivelyAwardAchievements(db);
  
  return true;
}

/**
 * Seed default achievements and tiers if empty
 */
function seedAchievements(db) {
  try {
    const existing = db.prepare("SELECT COUNT(*) as c FROM achievements").get().c;
    if (existing === 0) {
      console.log('[DB Init] Seeding default achievements and tiers...');
      const achs = [
        { id: 'streak_puffer', name: 'Pufferfish Pride', desc: 'Maintain a daily translation/review streak.', cat: 'streak' },
        { id: 'translation_angler', name: 'Deep Sea Translator', desc: 'Translate terms to help grow the marine knowledge base.', cat: 'translations' },
        { id: 'review_turtle', name: 'Coral Conservator', desc: 'Review other translators\' work for quality control.', cat: 'reviews' },
        { id: 'discussion_dolphin', name: 'Ocean Talker', desc: 'Participate in term discussions and translation appeals.', cat: 'discussions' },
        { id: 'reputation_stingray', name: 'Tidal Wave', desc: 'Earn gamification points and build reputation.', cat: 'points' },
        { id: 'goal_seahorse', name: 'Goal Getter', desc: 'Complete your daily translation/review goals.', cat: 'daily_goals' }
      ];
      
      const insertAch = db.prepare("INSERT INTO achievements (id, name, description, category) VALUES (?, ?, ?, ?)");
      const insertTier = db.prepare("INSERT INTO achievement_tiers (achievement_id, tier, target_value, reward_points) VALUES (?, ?, ?, ?)");
      
      db.transaction(() => {
        for (const a of achs) {
          insertAch.run(a.id, a.name, a.desc, a.cat);
          const targets = {
            streak_puffer: [3, 7, 30],
            translation_angler: [10, 50, 250],
            review_turtle: [20, 100, 500],
            discussion_dolphin: [5, 25, 100],
            reputation_stingray: [50, 250, 1000],
            goal_seahorse: [5, 25, 100]
          }[a.id];
          const rewards = [10, 25, 100];
          insertTier.run(a.id, 1, targets[0], rewards[0]);
          insertTier.run(a.id, 2, targets[1], rewards[1]);
          insertTier.run(a.id, 3, targets[2], rewards[2]);
        }
      })();
      console.log('[DB Init] ✓ Achievements and tiers seeded successfully');
    }
  } catch (err) {
    console.error('[DB Init] ERROR seeding achievements:', err.message);
  }
}

/**
 * Check all users in the database and retroactively award achievements they are eligible for.
 */
function retroactivelyAwardAchievements(db) {
  try {
    console.log('[DB Init] Running retroactive achievement awards for all users...');
    const { checkAndAwardAchievements } = require("./achievement.service");
    
    // Get all users
    const users = db.prepare("SELECT id FROM users").all();
    let totalUnlockedCount = 0;
    
    for (const user of users) {
      const newlyUnlocked = checkAndAwardAchievements(user.id);
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        totalUnlockedCount += newlyUnlocked.length;
      }
    }
    
    console.log(`[DB Init] ✓ Retroactive achievement check completed. Newly awarded ${totalUnlockedCount} achievements across ${users.length} users.`);
  } catch (err) {
    console.error('[DB Init] ERROR running retroactive achievements:', err.message);
  }
}


/**
 * Run bootstrap process on app startup
 */
function bootstrap() {
  try {
    console.log('[DB Init] Starting database initialization...');
    initializeDatabase();
    console.log('[DB Init] Database ready');
    
    // Initialize language communities
    console.log('[DB Init] Initializing language communities...');
    const result = initializeLanguageCommunities();
    if (result.success) {
      console.log(`[DB Init] ✓ Language communities initialized (${result.created} created)`);
    } else {
      console.error('[DB Init] WARNING: Failed to initialize language communities:', result.error);
    }

    // Initialize collection community goals per language for all sources
    console.log('[DB Init] Ensuring collection community goals per language for all sources...');
    const { ensureCollectionGoalsForAllSources } = require("./sourceGoalAutoCreation.service");
    const goalResult = ensureCollectionGoalsForAllSources();
    if (goalResult.success) {
      console.log(`[DB Init] ✓ Collection community goals initialized (${goalResult.totalCreatedGoalsCount} created)`);
    } else {
      console.error('[DB Init] WARNING: Failed to initialize collection community goals:', goalResult.error);
    }
  } catch (err) {
    console.error('[DB Init] ERROR: Failed to initialize database:', err.message);
    console.error('[DB Init] Stack trace:', err.stack);
    throw new Error(`Database initialization failed: ${err.message}`);
  }
}

module.exports = {
  initializeDatabase,
  bootstrap,
  ensureDatabaseDirectory,
  databaseFileExists,
};
