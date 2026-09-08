'use strict';

const userRepository = require('../repositories/userRepository');

/**
 * Authentication middleware.
 * Checks session first, then falls back to API key authentication.
 * Attaches encKey (Buffer) to req for field-level encryption/decryption.
 */
function requireAuth(req, res, next) {
  // 1. Check session first (existing behavior)
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    // Attach encryption key from session (hex → Buffer)
    if (req.session.encKey) {
      req.encKey = Buffer.from(req.session.encKey, 'hex');
    } else {
      req.encKey = null;
    }
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

      // Unwrap encryption key from stored enc_key_encrypted using SESSION_SECRET
      if (user.enc_key_encrypted) {
        try {
          const cryptoService = require('../services/crypto');
          req.encKey = cryptoService.unwrapKeyFromStorage(user.enc_key_encrypted);
        } catch (e) {
          req.encKey = null;
        }
      } else {
        // E2E mode — API key cannot decrypt
        return res.status(403).json({ 
          error: 'גישת API אינה זמינה במצב הצפנה E2E. יש להפעיל "גישה מורחבת" בהגדרות.' 
        });
      }
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = requireAuth;
