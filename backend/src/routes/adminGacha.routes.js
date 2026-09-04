const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const { apiLimiter } = require('../middleware/rateLimit');

/**
 * GET /api/admin/gacha/users
 * Returns list of users with ecosystem details and access states
 */
router.get('/admin/gacha/users', requireAdmin, apiLimiter, (req, res) => {
  try {
    const db = getDatabase();
    const search = req.query.q ? `%${req.query.q.trim()}%` : null;

    let query = `
      SELECT 
        u.id,
        u.username,
        u.is_admin,
        u.extra,
        COALESCE(e.has_gacha_access, 0) as has_gacha_access,
        COALESCE(e.tickets, 0) as dive_tickets,
        COALESCE(e.food_flakes, 5) as food_flakes,
        COALESCE(e.super_pellets, 1) as super_pellets,
        COALESCE(e.water_quality, 100) as water_quality,
        (SELECT COUNT(*) FROM user_fishes WHERE user_id = u.id) as fishes_count
      FROM users u
      LEFT JOIN user_ecosystem e ON u.id = e.user_id
    `;
    const params = [];

    if (search) {
      query += ` WHERE u.username LIKE ? `;
      params.push(search);
    }

    query += ` ORDER BY u.id ASC LIMIT 200 `;

    const rows = db.prepare(query).all(...params);

    const users = rows.map(r => {
      let isSuperAdmin = false;
      try {
        if (r.extra) {
          const extra = JSON.parse(r.extra);
          isSuperAdmin = Boolean(extra.is_superadmin);
        }
      } catch (e) {}

      return {
        id: r.id,
        username: r.username,
        is_admin: r.is_admin,
        is_superadmin: isSuperAdmin,
        has_gacha_access: r.has_gacha_access,
        dive_tickets: r.dive_tickets,
        tickets: r.dive_tickets,
        food_flakes: r.food_flakes,
        super_pellets: r.super_pellets,
        water_quality: r.water_quality,
        fishes_count: r.fishes_count
      };
    });

    const summary = {
      total_users_with_access: db.prepare(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        LEFT JOIN user_ecosystem e ON u.id = e.user_id
        WHERE u.is_admin = 1 OR e.has_gacha_access = 1
      `).get().count,
      total_tickets_in_circulation: db.prepare(`
        SELECT COALESCE(SUM(tickets), 0) as total FROM user_ecosystem
      `).get().total,
      total_fishes_caught: db.prepare(`
        SELECT COUNT(*) as total FROM user_fishes
      `).get().total
    };

    res.json({ users, summary });
  } catch (err) {
    console.error('[Admin Gacha] Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch gacha user list' });
  }
});

/**
 * PATCH /api/admin/gacha/users/:id/access
 * Toggles or sets user access to the Gacha / Oceanarium
 */
router.patch('/admin/gacha/users/:id/access', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { has_access } = req.body;
    const accessVal = has_access ? 1 : 0;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upsert into user_ecosystem
    db.prepare(`
      INSERT INTO user_ecosystem (user_id, has_gacha_access)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET has_gacha_access = excluded.has_gacha_access
    `).run(userId, accessVal);

    res.json({ ok: true, userId, has_gacha_access: accessVal });
  } catch (err) {
    console.error('[Admin Gacha] Error updating access:', err);
    res.status(500).json({ error: 'Failed to update user access' });
  }
});

/**
 * POST /api/admin/gacha/users/:id/grant-resources
 * Grants tickets, food flakes, super pellets, or resets water quality
 */
router.post('/admin/gacha/users/:id/grant-resources', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tickets = 0, food_flakes = 0, super_pellets = 0, reset_water = false } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure ecosystem exists
    db.prepare(`
      INSERT OR IGNORE INTO user_ecosystem (user_id) VALUES (?)
    `).run(userId);

    let query = `
      UPDATE user_ecosystem
      SET tickets = MAX(0, tickets + ?),
          food_flakes = MAX(0, food_flakes + ?),
          super_pellets = MAX(0, super_pellets + ?)
    `;
    const params = [parseInt(tickets, 10) || 0, parseInt(food_flakes, 10) || 0, parseInt(super_pellets, 10) || 0];

    if (reset_water) {
      query += `, water_quality = 100 `;
    }

    query += ` WHERE user_id = ? `;
    params.push(userId);

    db.prepare(query).run(...params);

    const updated = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
    res.json({ ok: true, ecosystem: updated });
  } catch (err) {
    console.error('[Admin Gacha] Error granting resources:', err);
    res.status(500).json({ error: 'Failed to grant resources' });
  }
});

/**
 * GET /api/admin/gacha/users/:id/tank
 * Returns target user's ecosystem status and all caught specimens
 */
router.get('/admin/gacha/users/:id/tank', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const db = getDatabase();
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let eco = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
    if (!eco) {
      db.prepare('INSERT INTO user_ecosystem (user_id) VALUES (?)').run(userId);
      eco = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
    }

    const fishes = db.prepare(`
      SELECT 
        uf.id,
        uf.user_id,
        uf.species_id,
        uf.nickname,
        uf.status,
        uf.caught_at,
        uf.is_favorite,
        s.name,
        s.depth_zone,
        s.rarity,
        s.visual_traits,
        s.description
      FROM user_fishes uf
      JOIN gacha_species s ON uf.species_id = s.id
      WHERE uf.user_id = ?
      ORDER BY uf.caught_at DESC, uf.id DESC
    `).all(userId);

    res.json({ ecosystem: eco, fishes });
  } catch (err) {
    console.error('[Admin Gacha] Error fetching user tank:', err);
    res.status(500).json({ error: 'Failed to fetch user tank' });
  }
});

/**
 * DELETE /api/admin/gacha/users/:id/fishes/:fishId
 * Deletes a specific fish for a user
 */
router.delete('/admin/gacha/users/:id/fishes/:fishId', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const fishId = parseInt(req.params.fishId, 10);
    const db = getDatabase();

    const fish = db.prepare('SELECT id FROM user_fishes WHERE id = ? AND user_id = ?').get(fishId, userId);
    if (!fish) return res.status(404).json({ error: 'Fish not found for this user' });

    db.prepare('DELETE FROM user_fishes WHERE id = ? AND user_id = ?').run(fishId, userId);
    const remainingCount = db.prepare('SELECT COUNT(*) as count FROM user_fishes WHERE user_id = ?').get(userId).count;

    res.json({ ok: true, deletedFishId: fishId, remainingCount });
  } catch (err) {
    console.error('[Admin Gacha] Error deleting fish:', err);
    res.status(500).json({ error: 'Failed to delete fish' });
  }
});

/**
 * PATCH /api/admin/gacha/users/:id/fishes/:fishId
 * Updates nickname or favorite flag for a user's fish
 */
router.patch('/admin/gacha/users/:id/fishes/:fishId', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const fishId = parseInt(req.params.fishId, 10);
    const { nickname, is_favorite } = req.body;
    const db = getDatabase();

    const fish = db.prepare('SELECT id FROM user_fishes WHERE id = ? AND user_id = ?').get(fishId, userId);
    if (!fish) return res.status(404).json({ error: 'Fish not found for this user' });

    const updates = [];
    const params = [];
    if (nickname !== undefined) {
      updates.push('nickname = ?');
      params.push(nickname ? nickname.trim() : null);
    }
    if (is_favorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(is_favorite ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(fishId, userId);
      db.prepare(`UPDATE user_fishes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM user_fishes WHERE id = ?').get(fishId);
    res.json({ ok: true, fish: updated });
  } catch (err) {
    console.error('[Admin Gacha] Error updating fish:', err);
    res.status(500).json({ error: 'Failed to update fish' });
  }
});

/**
 * POST /api/admin/gacha/users/:id/reset-tank
 * Configurable transactional reset of user tank
 */
router.post('/admin/gacha/users/:id/reset-tank', requireAdmin, apiLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const {
      delete_fishes = false,
      reset_water = false,
      reset_pity = false,
      reset_food = false
    } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const transaction = db.transaction(() => {
      if (delete_fishes) {
        db.prepare('DELETE FROM user_fishes WHERE user_id = ?').run(userId);
      }

      const ecoUpdates = [];
      if (reset_water) ecoUpdates.push('water_quality = 100');
      if (reset_pity) ecoUpdates.push('pity_counter_epic = 0, pity_counter_legendary = 0');
      if (reset_food) ecoUpdates.push('food_flakes = 5, super_pellets = 1');

      if (ecoUpdates.length > 0) {
        db.prepare('INSERT OR IGNORE INTO user_ecosystem (user_id) VALUES (?)').run(userId);
        db.prepare(`UPDATE user_ecosystem SET ${ecoUpdates.join(', ')} WHERE user_id = ?`).run(userId);
      }
    });

    transaction();

    const ecosystem = db.prepare('SELECT * FROM user_ecosystem WHERE user_id = ?').get(userId);
    const fishes_count = db.prepare('SELECT COUNT(*) as count FROM user_fishes WHERE user_id = ?').get(userId).count;

    res.json({ ok: true, ecosystem, fishes_count });
  } catch (err) {
    console.error('[Admin Gacha] Error resetting tank:', err);
    res.status(500).json({ error: 'Failed to reset user tank' });
  }
});

module.exports = router;
