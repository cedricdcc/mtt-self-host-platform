const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/admin.middleware');
const ecosystemService = require('../services/ecosystem.service');

// All ecosystem routes require authentication and admin rights during preview
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @openapi
 * /api/ecosystem:
 *   get:
 *     summary: Get user ecosystem status, water health, and living fishes
 *     tags: [Ecosystem]
 *     responses:
 *       200:
 *         description: Ecosystem state and fishes
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Not an admin
 */
router.get('/', (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.user_id;
    const state = ecosystemService.getEcosystemState(userId);
    res.json(state);
  } catch (err) {
    console.error('[Ecosystem API Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/ecosystem/feed:
 *   post:
 *     summary: Feed ecosystem with food flake or super pellet
 *     tags: [Ecosystem]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [food_type]
 *             properties:
 *               food_type:
 *                 type: string
 *                 enum: [flake, super_pellet]
 *     responses:
 *       200:
 *         description: Updated ecosystem status
 */
router.post('/feed', (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.user_id;
    const { food_type } = req.body;

    if (!food_type || !['flake', 'super_pellet'].includes(food_type)) {
      return res.status(400).json({ error: "Invalid or missing food_type. Must be 'flake' or 'super_pellet'." });
    }

    const updated = ecosystemService.feedEcosystem(userId, food_type);
    const fullState = ecosystemService.getEcosystemState(userId);
    res.json(fullState);
  } catch (err) {
    console.error('[Ecosystem Feed Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/ecosystem/fishes/{id}:
 *   patch:
 *     summary: Update fish nickname or favorite status
 *     tags: [Ecosystem]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *               is_favorite:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated fish record
 */
router.patch('/fishes/:id', (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.user_id;
    const fishId = parseInt(req.params.id, 10);
    const { nickname, is_favorite } = req.body;

    const updated = ecosystemService.updateFish(userId, fishId, { nickname, is_favorite });
    res.json(updated);
  } catch (err) {
    console.error('[Ecosystem Update Fish Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
