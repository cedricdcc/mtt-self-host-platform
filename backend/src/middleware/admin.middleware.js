// Admin middleware specifically for Oceanarium & Gacha preview

const { requireAuth } = require('./admin');

/**
 * Middleware to require admin privileges with oceanarium-specific messaging
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.session.user;
  const isAdmin = Boolean(user.is_admin || user.is_superadmin || user.isAdmin);

  if (!isAdmin) {
    return res.status(403).json({ error: 'Oceanarium access is restricted to administrators during preview.' });
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};
