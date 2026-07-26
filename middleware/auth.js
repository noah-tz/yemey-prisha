'use strict';

const userRepository = require('../repositories/userRepository');

/**
 * Authentication middleware.
 * Checks session first, then falls back to API key authentication.
 * Supports X-API-Key header or Authorization: Bearer <key>.
 */
function requireAuth(req, res, next) {
  // 1. Check session first (existing behavior)
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  // 2. Check API key (X-API-Key header or Authorization: Bearer)
  let apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7);
    }
  }

  if (apiKey) {
    const user = userRepository.findByApiKey(apiKey);
    if (user) {
      req.userId = user.id;
      req.isApiAuth = true;
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = requireAuth;
