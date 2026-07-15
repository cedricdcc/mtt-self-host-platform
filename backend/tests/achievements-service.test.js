const assert = require('assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_achievements_service.db');
process.env.SQLITE_DB_PATH = testDbPath;

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');
const service = require('../src/services/achievement.service');

async function run() {
  initializeDatabase();
  const db = getDatabase();

  // Create a mock user
  db.prepare("INSERT INTO users (id, username, reputation) VALUES (1, 'alice', 0)").run();
  db.prepare("INSERT INTO user_stats (user_id, points, daily_streak, longest_streak) VALUES (1, 0, 0, 0)").run();

  // Run checking - should award nothing
  const newUnlocks1 = service.checkAndAwardAchievements(1);
  assert.strictEqual(newUnlocks1.length, 0);

  // Update stats to trigger Bronze Streak (requires 3 days) and Bronze Translator (requires 10 translations)
  db.prepare("UPDATE user_stats SET longest_streak = 4, translations_count = 11 WHERE user_id = 1").run();

  // Check and award - should award streak_puffer tier 1 and translation_angler tier 1
  const newUnlocks2 = service.checkAndAwardAchievements(1);
  assert.strictEqual(newUnlocks2.length, 2);
  assert.ok(newUnlocks2.some(x => x.achievement_id === 'streak_puffer' && x.tier === 1));
  assert.ok(newUnlocks2.some(x => x.achievement_id === 'translation_angler' && x.tier === 1));

  // Check reputation and stats points are updated (Bronze reward is 10 points each)
  const user = db.prepare("SELECT reputation FROM users WHERE id = 1").get();
  assert.strictEqual(user.reputation, 20);

  const stats = db.prepare("SELECT points FROM user_stats WHERE user_id = 1").get();
  assert.strictEqual(stats.points, 20);

  // Get user achievements with progress
  const progressList = service.getUserAchievementsWithProgress(1);
  const streakAch = progressList.find(x => x.id === 'streak_puffer');
  assert.strictEqual(streakAch.currentProgress, 4);
  assert.strictEqual(streakAch.tiers[0].unlocked, true);
  assert.strictEqual(streakAch.tiers[1].unlocked, false);

  console.log("✓ Achievements Service logic check passed!");
  
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}
run().catch(e => {
  console.error("Test Failed:", e.message);
  if (fs.existsSync(testDbPath)) {
    try {
      const db = getDatabase();
      db.close();
    } catch(err) {}
    try {
      fs.unlinkSync(testDbPath);
    } catch(err) {}
  }
  process.exit(1);
});
