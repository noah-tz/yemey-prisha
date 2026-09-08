'use strict';

const db = require('../db');

/**
 * Middleware that requires the user to be authenticated AND have is_admin = 1.
 * Must be used after requireAuth middleware.
 */
function requireAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = requireAdmin;
