// backend/tests/admin-api.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, 'test_admin_api.db');
process.env.SQLITE_DB_PATH = testDbPath;

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

async function run() {
  console.log("Running admin endpoint query test...");
  initializeDatabase();
  const db = getDatabase();

  db.prepare("INSERT INTO users (id, username, reputation) VALUES (1, 'translator', 10)").run();
  db.prepare("INSERT INTO users (id, username, reputation) VALUES (2, 'voter1', 120)").run(); // rep 120 -> weight 2
  db.prepare("INSERT INTO terms (id, uri) VALUES (10, 'http://example.com/term')").run();
  db.prepare("INSERT INTO term_fields (id, term_id, field_uri, original_value) VALUES (20, 10, 'label', 'Original')").run();
  db.prepare(`
    INSERT INTO translations (id, term_field_id, language, value, status, created_by_id, created_at)
    VALUES (50, 20, 'nl', 'Vertaling', 'review', 1, datetime('now'))
  `).run();
  db.prepare("INSERT INTO translation_reviews (translation_id, user_id, action) VALUES (50, 2, 'approve')").run();

  // Query mimicking the endpoint logic
  const pending = db.prepare(`
    SELECT t.id, t.language, t.value, t.created_at, tf.field_uri, term.uri
    FROM translations t
    JOIN term_fields tf ON t.term_field_id = tf.id
    JOIN terms term ON tf.term_id = term.id
    WHERE t.status IN ('review', 'discussion')
  `).all();

  assert.strictEqual(pending.length, 1);
  
  const votes = db.prepare(`
    SELECT tr.action, tr.user_id, u.username, u.reputation
    FROM translation_reviews tr
    JOIN users u ON tr.user_id = u.id
    WHERE tr.translation_id = ?
  `).all(pending[0].id);

  assert.strictEqual(votes.length, 1);
  assert.strictEqual(votes[0].username, 'voter1');
  assert.strictEqual(votes[0].reputation, 120);

  console.log("✓ Admin API query tests passed!");
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

run().catch(err => {
  console.error("Test Failed:", err.message);
  process.exit(1);
});
