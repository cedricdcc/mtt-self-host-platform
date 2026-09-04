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

module.exports = router;
