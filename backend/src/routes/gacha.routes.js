const express = require('express');
const router = express.Router();
const { requireAuth, requireEcosystemAccess } = require('../middleware/admin.middleware');
const ecosystemService = require('../services/ecosystem.service');

// All gacha routes require authentication and ecosystem access (admin, superadmin, or granted access)
router.use(requireAuth);
router.use(requireEcosystemAccess);

/**
 * @openapi
 * /api/gacha/pull:
 *   post:
 *     summary: Spend tickets to dive and collect marine species
 *     tags: [Gacha]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [count]
 *             properties:
 *               count:
 *                 type: integer
 *                 enum: [1, 10]
 *     responses:
 *       200:
 *         description: Gacha pull results and updated ecosystem
 */
router.post('/pull', (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.user_id;
    const count = parseInt(req.body.count, 10) || 1;

    if (count !== 1 && count !== 10) {
      return res.status(400).json({ error: "Pull count must be 1 or 10." });
    }

    const pullResult = ecosystemService.pullGacha(userId, count);
    res.json(pullResult);
  } catch (err) {
    console.error('[Gacha Pull Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/gacha/codex:
 *   get:
 *     summary: Get marine species codex and discovery progress
 *     tags: [Gacha]
 *     responses:
 *       200:
 *         description: Codex catalog with discovery status
 */
router.get('/codex', (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.user_id;
    const codex = ecosystemService.getCodex(userId);
    res.json(codex);
  } catch (err) {
    console.error('[Gacha Codex Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
