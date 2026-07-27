const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const userRepository = require('../repositories/userRepository');
const cycleService = require('../services/cycleService');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/settings/api-key
 * Get the current user's API key (or null if not generated).
 */
router.get('/api-key', (req, res) => {
  try {
    const key = userRepository.getApiKey(req.userId);
    return res.json({ apiKey: key });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/settings/api-key
 * Generate (or regenerate) an API key for the current user.
 */
router.post('/api-key', (req, res) => {
  try {
    const key = userRepository.generateApiKey(req.userId);
    return res.json({ apiKey: key, message: 'API key generated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/settings
 * Get the current user's settings.
 */
router.get('/', (req, res) => {
  try {
    const user = userRepository.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      posek: user.posek,
      onah_beinonit_31: !!user.onah_beinonit_31,
      or_zarua: !!user.or_zarua,
      haflagah_shlishit: !!user.haflagah_shlishit,
      hachodesh_overflow: !!user.hachodesh_overflow,
      reminder_enabled: !!user.reminder_enabled,
      reminder_email: user.reminder_email || ''
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/settings
 * Update user settings. Supports: posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow.
 * On any change, recalculates all vestot.
 */
router.put('/', (req, res) => {
  try {
    const { posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow, reminder_enabled, reminder_email } = req.body;

    // Validate posek if provided
    if (posek !== undefined && posek !== 'rama' && posek !== 'mechaber') {
      return res.status(400).json({ error: "posek must be 'rama' or 'mechaber'" });
    }

    // Build settings object with only provided fields
    const settingsUpdate = {};
    if (posek !== undefined) settingsUpdate.posek = posek;
    if (onah_beinonit_31 !== undefined) settingsUpdate.onah_beinonit_31 = onah_beinonit_31;
    if (or_zarua !== undefined) settingsUpdate.or_zarua = or_zarua;
    if (haflagah_shlishit !== undefined) settingsUpdate.haflagah_shlishit = haflagah_shlishit;
    if (hachodesh_overflow !== undefined) settingsUpdate.hachodesh_overflow = hachodesh_overflow;
    if (reminder_enabled !== undefined) settingsUpdate.reminder_enabled = reminder_enabled;
    if (reminder_email !== undefined) settingsUpdate.reminder_email = reminder_email;

    if (Object.keys(settingsUpdate).length === 0) {
      return res.status(400).json({ error: 'No settings provided' });
    }

    userRepository.updateSettings(req.userId, settingsUpdate);

    // Recalculate all vestot with new settings (encryption-aware) — only if halachic settings changed
    const halachicFields = ['posek', 'onah_beinonit_31', 'or_zarua', 'haflagah_shlishit', 'hachodesh_overflow'];
    const hasHalachicChange = halachicFields.some(f => settingsUpdate[f] !== undefined);
    if (hasHalachicChange) {
      cycleService.recalculateVestot(req.userId, req.encKey);
    }

    // Get updated user for response
    const user = userRepository.findById(req.userId);

    return res.json({
      posek: user.posek,
      onah_beinonit_31: !!user.onah_beinonit_31,
      or_zarua: !!user.or_zarua,
      haflagah_shlishit: !!user.haflagah_shlishit,
      hachodesh_overflow: !!user.hachodesh_overflow,
      reminder_enabled: !!user.reminder_enabled,
      reminder_email: user.reminder_email || '',
      message: hasHalachicChange ? 'Settings updated, vestot recalculated' : 'Settings updated'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/settings/enable-extended
 * Enable extended mode (save enc_key_encrypted for API/reminders).
 * Requires active session with encKey.
 */
router.post('/enable-extended', (req, res) => {
  try {
    if (!req.encKey) {
      return res.status(400).json({ error: 'יש להתחבר מחדש כדי להפעיל גישה מורחבת' });
    }
    const cryptoService = require('../services/crypto');
    const db = require('../db');
    const encKeyEncrypted = cryptoService.wrapKeyForStorage(req.encKey);
    db.prepare('UPDATE users SET enc_key_encrypted = ? WHERE id = ?').run(encKeyEncrypted, req.userId);
    
    // Log consent for this action
    db.prepare(
      'INSERT INTO consent_log (user_id, terms_version, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(req.userId, 'extended-mode-1.0', req.ip || '', req.headers['user-agent'] || '');
    
    return res.json({ message: 'גישה מורחבת הופעלה', mode: 'extended' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/settings/disable-extended
 * Disable extended mode (delete enc_key_encrypted, return to E2E).
 */
router.post('/disable-extended', (req, res) => {
  try {
    const db = require('../db');
    db.prepare('UPDATE users SET enc_key_encrypted = NULL WHERE id = ?').run(req.userId);
    // Also disable reminders since they won't work without extended mode
    db.prepare('UPDATE users SET reminder_enabled = 0 WHERE id = ?').run(req.userId);
    return res.json({ message: 'חזרה למצב הצפנה E2E', mode: 'e2e' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/settings/encryption-mode
 * Check current encryption mode.
 */
router.get('/encryption-mode', (req, res) => {
  try {
    const db = require('../db');
    const user = db.prepare('SELECT enc_key_encrypted FROM users WHERE id = ?').get(req.userId);
    const mode = user && user.enc_key_encrypted ? 'extended' : 'e2e';
    return res.json({ mode });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
