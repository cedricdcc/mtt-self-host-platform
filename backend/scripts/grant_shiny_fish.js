/**
 * Helper script to grant a Shiny Fish specimen to a user for testing
 * Usage: node scripts/grant_shiny_fish.js [userId] [speciesId]
 */
const { getDatabase } = require('../src/db/database');
const { initializeDatabase } = require('../src/services/dbInit.service');

initializeDatabase();
const db = getDatabase();

const userId = parseInt(process.argv[2] || '1', 10);
const speciesId = process.argv[3] || 'azure_damselfish';

const species = db.prepare("SELECT * FROM gacha_species WHERE id = ?").get(speciesId);
if (!species) {
  console.error(`Species not found: ${speciesId}`);
  process.exit(1);
}

const res = db.prepare(`
  INSERT INTO user_fishes (user_id, species_id, nickname, status, is_shiny)
  VALUES (?, ?, ?, 'active', 1)
`).run(userId, speciesId, `Sparkle ${species.name}`);

console.log(`✓ Granted Shiny ${species.name} (user_fish_id: ${res.lastInsertRowid}) to user ID ${userId}!`);
