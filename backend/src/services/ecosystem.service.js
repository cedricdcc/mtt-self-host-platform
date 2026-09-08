// Ecosystem service - handles user habitat, water decay, feeding, and gacha mechanics

const { getDatabase, resolveUsernameToId } = require("../db/database");

/**
 * Resolve user identifier to numeric user_id
 * @param {number|string} userIdentifier
 * @returns {number|null}
 */
function resolveUserId(userIdentifier) {
  if (typeof userIdentifier === 'number') return userIdentifier;
  const asNumber = parseInt(userIdentifier, 10);
  if (!isNaN(asNumber) && asNumber.toString() === userIdentifier.toString()) {
    return asNumber;
  }
  return resolveUsernameToId(userIdentifier);
}

/**
 * Ensure user ecosystem record exists
 * @param {number|string} userIdentifier
 * @returns {object} user_ecosystem record
 */
function ensureUserEcosystem(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  let eco = db.prepare("SELECT * FROM user_ecosystem WHERE user_id = ?").get(userId);
  if (!eco) {
    db.prepare(`
      INSERT INTO user_ecosystem (
        user_id, tickets, food_flakes, super_pellets, water_quality,
        last_fed_at, last_decay_at, pity_counter_epic, pity_counter_legendary, total_pulls
      ) VALUES (?, 0, 5, 1, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, 0)
    `).run(userId);
    eco = db.prepare("SELECT * FROM user_ecosystem WHERE user_id = ?").get(userId);
  }
  return eco;
}

/**
 * Get human-readable health status band
 * @param {number} waterQuality
 * @returns {string} 'thriving' | 'stable' | 'distressed' | 'dormant'
 */
function getHealthStatus(waterQuality) {
  if (waterQuality >= 80) return 'thriving';
  if (waterQuality >= 40) return 'stable';
  if (waterQuality > 0) return 'distressed';
  return 'dormant';
}

/**
 * Apply lazy decay on read
 * @param {object} eco
 * @returns {object} updated eco
 */
function applyLazyDecay(eco) {
  const db = getDatabase();
  if (!eco.last_decay_at) return eco;

  const lastDecay = new Date(eco.last_decay_at.replace(' ', 'T') + 'Z').getTime();
  const now = Date.now();
  const msElapsed = Math.max(0, now - lastDecay);
  const daysElapsed = Math.floor(msElapsed / (24 * 60 * 60 * 1000));

  if (daysElapsed > 0) {
    const decayAmount = daysElapsed * 15;
    const newWaterQuality = Math.max(0, eco.water_quality - decayAmount);

    db.prepare(`
      UPDATE user_ecosystem
      SET water_quality = ?,
          last_decay_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newWaterQuality, eco.user_id);

    if (newWaterQuality === 0) {
      // Put non-favorite fish into dormant state
      db.prepare(`
        UPDATE user_fishes
        SET status = 'dormant'
        WHERE user_id = ? AND is_favorite = 0
      `).run(eco.user_id);
    }

    eco.water_quality = newWaterQuality;
    eco.last_decay_at = new Date().toISOString();
  }

  return eco;
}

/**
 * Get full user ecosystem state and active/dormant fishes
 * @param {number|string} userIdentifier
 * @returns {object} { ecosystem, fishes }
 */
function getEcosystemState(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  let eco = ensureUserEcosystem(userId);
  eco = applyLazyDecay(eco);

  const fishes = db.prepare(`
    SELECT uf.id as user_fish_id, uf.species_id, uf.nickname, uf.status, uf.caught_at, uf.is_favorite, uf.is_shiny,
           gs.name, gs.depth_zone, gs.rarity, gs.description, gs.visual_traits, gs.model_url
    FROM user_fishes uf
    JOIN gacha_species gs ON uf.species_id = gs.id
    WHERE uf.user_id = ?
    ORDER BY uf.is_favorite DESC, uf.caught_at DESC
  `).all(userId).map(f => ({
    ...f,
    is_shiny: Boolean(f.is_shiny),
    visual_traits: typeof f.visual_traits === 'string' ? JSON.parse(f.visual_traits) : f.visual_traits
  }));

  return {
    ecosystem: {
      ...eco,
      health_status: getHealthStatus(eco.water_quality)
    },
    fishes
  };
}

/**
 * Feed ecosystem with food flakes or super pellets
 * @param {number|string} userIdentifier
 * @param {'flake'|'super_pellet'} foodType
 * @returns {object} updated ecosystem
 */
function feedEcosystem(userIdentifier, foodType) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  let eco = ensureUserEcosystem(userId);
  eco = applyLazyDecay(eco);

  if (foodType === 'flake') {
    if (eco.food_flakes < 1) throw new Error("Not enough food flakes");
    const newQuality = Math.min(100, eco.water_quality + 10);
    db.prepare(`
      UPDATE user_ecosystem
      SET food_flakes = food_flakes - 1,
          water_quality = ?,
          last_fed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newQuality, userId);
  } else if (foodType === 'super_pellet') {
    if (eco.super_pellets < 1) throw new Error("Not enough super pellets");
    const newQuality = Math.min(100, eco.water_quality + 25);
    db.prepare(`
      UPDATE user_ecosystem
      SET super_pellets = super_pellets - 1,
          water_quality = ?,
          last_fed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(newQuality, userId);
  } else {
    throw new Error("Invalid food type. Must be 'flake' or 'super_pellet'");
  }

  // Revive dormant fishes if quality restored > 0
  db.prepare(`
    UPDATE user_fishes
    SET status = 'active'
    WHERE user_id = ? AND status = 'dormant'
  `).run(userId);

  return db.prepare("SELECT * FROM user_ecosystem WHERE user_id = ?").get(userId);
}

/**
 * Roll weighted species with pity handling
 * @param {Array} allSpecies
 * @param {string|null} forcedRarity
 * @returns {object} rolled species
 */
function selectSpecies(allSpecies, forcedRarity = null) {
  let pool = allSpecies;
  if (forcedRarity) {
    const filtered = allSpecies.filter(s => s.rarity === forcedRarity);
    if (filtered.length > 0) pool = filtered;
  }

  const totalWeight = pool.reduce((sum, s) => sum + s.drop_weight, 0);
  let random = Math.random() * totalWeight;

  for (const s of pool) {
    if (random < s.drop_weight) {
      return s;
    }
    random -= s.drop_weight;
  }
  return pool[pool.length - 1];
}

/**
 * Pull Gacha (1 or 10 dives)
 * @param {number|string} userIdentifier
 * @param {number} count 1 or 10
 * @returns {object} { results, updated_ecosystem }
 */
function pullGacha(userIdentifier, count = 1) {
  if (count !== 1 && count !== 10) {
    throw new Error("Pull count must be 1 or 10");
  }

  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  let eco = ensureUserEcosystem(userId);
  if (eco.tickets < count) {
    throw new Error(`Not enough tickets. Required: ${count}, available: ${eco.tickets}`);
  }

  const allSpecies = db.prepare("SELECT * FROM gacha_species").all();
  if (!allSpecies || allSpecies.length === 0) {
    throw new Error("Gacha species catalog is empty");
  }

  const existingSpeciesIds = new Set(
    db.prepare("SELECT DISTINCT species_id FROM user_fishes WHERE user_id = ?").all(userId).map(r => r.species_id)
  );

  const results = [];
  let pityEpic = eco.pity_counter_epic;
  let pityLegendary = eco.pity_counter_legendary;
  let extraFlakesAwarded = 0;

  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let forcedRarity = null;

      // Pity Check
      if (pityLegendary + 1 >= 30) {
        forcedRarity = 'legendary';
      } else if (pityEpic + 1 >= 10) {
        forcedRarity = 'epic';
      } else if (count === 10 && i === 9) {
        // Multi-pull guarantee at least 1 rare+
        const hasRarePlus = results.some(r => ['rare', 'epic', 'legendary'].includes(r.rarity));
        if (!hasRarePlus) {
          forcedRarity = 'rare';
        }
      }

      const rolled = selectSpecies(allSpecies, forcedRarity);
      const isDuplicate = existingSpeciesIds.has(rolled.id);
      if (!isDuplicate) {
        existingSpeciesIds.add(rolled.id);
      } else {
        // Duplicate compensation: +3 Food Flakes
        extraFlakesAwarded += 3;
      }

      // Update pity counters
      if (rolled.rarity === 'legendary') {
        pityLegendary = 0;
        pityEpic = 0;
      } else if (rolled.rarity === 'epic') {
        pityEpic = 0;
        pityLegendary += 1;
      } else {
        pityEpic += 1;
        pityLegendary += 1;
      }

      // Check 1/500 shiny chance
      const isShiny = Math.random() < (1 / 500) ? 1 : 0;

      // Insert fish
      const insertResult = db.prepare(`
        INSERT INTO user_fishes (user_id, species_id, status, is_shiny)
        VALUES (?, ?, 'active', ?)
      `).run(userId, rolled.id, isShiny);

      // Log pull
      db.prepare(`
        INSERT INTO gacha_pull_logs (user_id, species_id, pull_type, is_shiny)
        VALUES (?, ?, ?, ?)
      `).run(userId, rolled.id, count === 10 ? 'multi' : 'single', isShiny);

      results.push({
        user_fish_id: insertResult.lastInsertRowid,
        species_id: rolled.id,
        name: rolled.name,
        depth_zone: rolled.depth_zone,
        rarity: rolled.rarity,
        description: rolled.description,
        visual_traits: typeof rolled.visual_traits === 'string' ? JSON.parse(rolled.visual_traits) : rolled.visual_traits,
        is_new_discovery: !isDuplicate,
        is_shiny: Boolean(isShiny)
      });
    }

    // Deduct tickets, update pity, total_pulls, and flakes
    db.prepare(`
      UPDATE user_ecosystem
      SET tickets = tickets - ?,
          food_flakes = food_flakes + ?,
          pity_counter_epic = ?,
          pity_counter_legendary = ?,
          total_pulls = total_pulls + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(count, extraFlakesAwarded, pityEpic, pityLegendary, count, userId);
  })();

  const updatedEco = db.prepare("SELECT * FROM user_ecosystem WHERE user_id = ?").get(userId);
  return {
    results,
    updated_ecosystem: {
      ...updatedEco,
      health_status: getHealthStatus(updatedEco.water_quality)
    },
    extra_flakes_awarded: extraFlakesAwarded
  };
}

/**
 * Get Marine Codex collection progress
 * @param {number|string} userIdentifier
 * @returns {object}
 */
function getCodex(userIdentifier) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  const allSpecies = db.prepare("SELECT * FROM gacha_species ORDER BY depth_zone, drop_weight DESC").all();
  const userCounts = db.prepare(`
    SELECT species_id, COUNT(*) as count, MIN(caught_at) as first_caught_at, MAX(is_shiny) as has_shiny
    FROM user_fishes
    WHERE user_id = ?
    GROUP BY species_id
  `).all(userId);

  const countMap = new Map();
  userCounts.forEach(c => {
    countMap.set(c.species_id, {
      count: c.count,
      first_caught_at: c.first_caught_at,
      has_shiny: Boolean(c.has_shiny)
    });
  });

  const species = allSpecies.map(s => {
    const userCatch = countMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      depth_zone: s.depth_zone,
      rarity: s.rarity,
      description: s.description,
      visual_traits: typeof s.visual_traits === 'string' ? JSON.parse(s.visual_traits) : s.visual_traits,
      is_discovered: Boolean(userCatch),
      discovered_shiny: Boolean(userCatch && userCatch.has_shiny),
      caught_count: userCatch ? userCatch.count : 0,
      first_caught_at: userCatch ? userCatch.first_caught_at : null
    };
  });

  const totalDiscovered = species.filter(s => s.is_discovered).length;
  const totalShinyDiscovered = species.filter(s => s.discovered_shiny).length;
  const completionPercentage = allSpecies.length > 0
    ? Math.round((totalDiscovered / allSpecies.length) * 100)
    : 0;

  const eco = ensureUserEcosystem(userId);

  return {
    species,
    total_species: allSpecies.length,
    total_discovered: totalDiscovered,
    total_shiny_discovered: totalShinyDiscovered,
    completion_percentage: completionPercentage,
    tickets: eco.tickets
  };
}

/**
 * Update user fish nickname or favorite status
 * @param {number|string} userIdentifier
 * @param {number} fishId
 * @param {object} updates { nickname, is_favorite }
 * @returns {object} updated fish
 */
function updateFish(userIdentifier, fishId, { nickname, is_favorite }) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) throw new Error(`User not found: ${userIdentifier}`);

  const existing = db.prepare("SELECT * FROM user_fishes WHERE id = ? AND user_id = ?").get(fishId, userId);
  if (!existing) throw new Error("Fish not found or does not belong to user");

  const newNickname = nickname !== undefined ? nickname : existing.nickname;
  const newFavorite = is_favorite !== undefined ? (is_favorite ? 1 : 0) : existing.is_favorite;

  db.prepare(`
    UPDATE user_fishes
    SET nickname = ?, is_favorite = ?
    WHERE id = ? AND user_id = ?
  `).run(newNickname, newFavorite, fishId, userId);

  return db.prepare("SELECT * FROM user_fishes WHERE id = ?").get(fishId);
}

/**
 * Atomically award tickets, food, or water quality to a user
 * @param {number|string} userIdentifier
 * @param {object} rewards { tickets, food_flakes, super_pellets, water_quality }
 */
function awardRewards(userIdentifier, rewards = {}) {
  const db = getDatabase();
  const userId = resolveUserId(userIdentifier);
  if (!userId) return;

  ensureUserEcosystem(userId);

  const tickets = rewards.tickets || 0;
  const foodFlakes = rewards.food_flakes || 0;
  const superPellets = rewards.super_pellets || 0;

  let query = `
    UPDATE user_ecosystem
    SET tickets = tickets + ?,
        food_flakes = food_flakes + ?,
        super_pellets = super_pellets + ?,
        updated_at = CURRENT_TIMESTAMP
  `;
  const params = [tickets, foodFlakes, superPellets];

  if (rewards.water_quality !== undefined) {
    query += `, water_quality = ?`;
    params.push(Math.min(100, Math.max(0, rewards.water_quality)));
  }

  query += ` WHERE user_id = ?`;
  params.push(userId);

  db.prepare(query).run(...params);
}

module.exports = {
  ensureUserEcosystem,
  getHealthStatus,
  applyLazyDecay,
  getEcosystemState,
  feedEcosystem,
  pullGacha,
  getCodex,
  updateFish,
  awardRewards
};
