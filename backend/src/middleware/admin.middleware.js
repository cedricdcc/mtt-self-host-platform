// Access middleware for Oceanarium & Gacha preview

const { requireAuth } = require('./admin');
const { getDatabase } = require('../db/database');

/**
 * Middleware to require ecosystem access:
 * Allowed if: is_admin === 1 OR is_superadmin === true OR user_ecosystem.has_gacha_access === 1
 */
function requireEcosystemAccess(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.session.user;
  const isSuperAdmin = Boolean(user.is_superadmin);
  const isAdmin = Boolean(user.is_admin || user.isAdmin);

  if (isSuperAdmin || isAdmin) {
    return next();
  }

  try {
    const db = getDatabase();
    const eco = db.prepare('SELECT has_gacha_access FROM user_ecosystem WHERE user_id = ?').get(user.id);
    if (eco && eco.has_gacha_access === 1) {
      return next();
    }
  } catch (err) {
    console.error('[Ecosystem Access] Error checking user access:', err);
  }

  return res.status(403).json({ error: 'Oceanarium access is restricted. Contact an administrator for access.' });
}

module.exports = {
  requireAuth,
  requireEcosystemAccess,
  requireAdmin: requireEcosystemAccess // Backward-compatible alias for existing imports
};
