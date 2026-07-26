'use strict';

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { migrateUserRecords } = require('../services/migratePlaintext');
const requireAuth = require('../middleware/auth');

/**
 * POST /register
 * Create a new user account.
 */
router.post('/register', async (req, res) => {
  // Block registration if ALLOW_REGISTRATION is set to 'false' or '0'
  const allowReg = process.env.ALLOW_REGISTRATION;
  if (allowReg === 'false' || allowReg === '0') {
    return res.status(403).json({ error: 'הרשמה סגורה כעת' });
  }

  try {
    const { email, password, termsAccepted } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({ error: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' });
    }

    const user = await authService.register(email, password);

    // Log consent
    const db = require('../db');
    db.prepare(
      'INSERT INTO consent_log (user_id, terms_version, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(user.id, '1.0', req.ip || req.connection.remoteAddress, req.headers['user-agent'] || '');
    db.prepare('UPDATE users SET terms_accepted = ? WHERE id = ?').run('1.0', user.id);

    req.session.userId = user.id;
    req.session.encKey = user.encKey; // hex string of encryption key
    return res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    if (err.message === 'Email already registered') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err.message === 'Password must be at least 8 characters') {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /login
 * Authenticate user and create session.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.login(email, password);
    req.session.userId = user.id;
    req.session.encKey = user.encKey; // hex string of encryption key
    return res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /logout
 * Destroy session (clears encKey from memory).
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  });
});

/**
 * POST /migrate-encryption
 * Encrypt existing plaintext records for the current user.
 * Requires authentication and an active encryption key.
 */
router.post('/migrate-encryption', requireAuth, (req, res) => {
  try {
    if (!req.encKey) {
      return res.status(400).json({ error: 'Encryption key not available. Please log out and log in again.' });
    }
    const result = migrateUserRecords(req.userId, req.encKey);
    return res.json({
      message: 'Migration complete',
      cyclesEncrypted: result.cyclesEncrypted,
      vestotsEncrypted: result.vestotsEncrypted
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
