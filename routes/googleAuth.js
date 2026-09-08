'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const cryptoService = require('../services/crypto');
const { saveUserData } = require('../services/userDataService');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://veset.dina-ins.co.il/api/auth/google/callback';

/**
 * GET /api/auth/google
 * Redirect to Google OAuth consent page.
 */
router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    access_type: 'online',
    prompt: 'select_account'
  });

  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback.
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/?error=google_auth_failed');
    }

    // Verify state
    if (state !== req.session.oauthState) {
      return res.redirect('/?error=invalid_state');
    }
    delete req.session.oauthState;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      return res.redirect('/?error=token_exchange_failed');
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': 'Bearer ' + tokens.access_token }
    });
    const googleUser = await userInfoResponse.json();

    if (!googleUser.email) {
      return res.redirect('/?error=no_email');
    }

    // Check if user exists by google_id or email
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleUser.id, googleUser.email);

    if (user) {
      // Existing user — update google_id if not set
      if (!user.google_id) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleUser.id, user.id);
      }

      // Set up session with encryption key
      let encKey;
      if (user.enc_key_encrypted) {
        // Extended mode — unwrap key
        encKey = cryptoService.unwrapKeyFromStorage(user.enc_key_encrypted);
      } else {
        // E2E mode — cannot login via Google (need password to decrypt)
        return res.redirect('/#login?error=e2e_google_blocked');
      }

      req.session.userId = user.id;
      req.session.encKey = encKey.toString('hex');

    } else {
      // New user — register with Google (extended mode by default)
      const encKey = crypto.randomBytes(32);
      const encKeyWrapped = cryptoService.wrapKeyForStorage(encKey);

      const stmt = db.prepare(
        'INSERT INTO users (email, password_hash, enc_salt, enc_key_encrypted, google_id) VALUES (?, ?, ?, ?, ?)'
      );
      const result = stmt.run(googleUser.email, '', null, encKeyWrapped, googleUser.id);
      const userId = result.lastInsertRowid;

      // Create empty padded blob
      saveUserData(userId, { cycles: [], vestot: [], mechitzot: [], nekiim: [], next_cycle_id: 1, next_veset_id: 1 }, encKey);

      // Log consent
      db.prepare(
        'INSERT INTO consent_log (user_id, terms_version, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      ).run(userId, 'google-oauth-1.0', req.ip || '', req.headers['user-agent'] || '');

      req.session.userId = userId;
      req.session.encKey = encKey.toString('hex');
    }

    // Redirect to app
    res.redirect('/#calendar');

  } catch (err) {
    console.error('[Google Auth] Error:', err.message);
    res.redirect('/?error=google_auth_error');
  }
});

module.exports = router;
