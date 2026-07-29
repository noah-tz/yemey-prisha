const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const userRepository = require('../repositories/userRepository');
const cycleService = require('../services/cycleService');
const db = require('../db');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/settings/sunset?date=YYYY-MM-DD
 * Get sunset time for a specific date at the user's location.
 */
router.get('/sunset', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const db = require('../db');
    const { getSunTimes } = require('../services/sunTimes');
    const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(req.userId);
    const lat = user ? user.latitude : 31.7683; // Default: Jerusalem
    const lng = user ? user.longitude : 35.2137;

    const times = getSunTimes(new Date(date), lat, lng);
    return res.json({ sunset: times.sunset, sunrise: times.sunrise, date: date });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
      reminder_email: user.reminder_email || '',
      nekiim_reminder: !!user.nekiim_reminder,
      nekiim_show_calendar: !!user.nekiim_show_calendar,
      latitude: user.latitude || null,
      longitude: user.longitude || null,
      is_admin: !!user.is_admin,
      is_owner: user.id === db.prepare('SELECT MIN(id) as id FROM users').get().id
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
    const { posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow, reminder_enabled, reminder_email, latitude, longitude, nekiim_reminder, nekiim_show_calendar, lang } = req.body;

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
    if (latitude !== undefined) settingsUpdate.latitude = latitude;
    if (longitude !== undefined) settingsUpdate.longitude = longitude;
    if (nekiim_reminder !== undefined) settingsUpdate.nekiim_reminder = nekiim_reminder;
    if (nekiim_show_calendar !== undefined) settingsUpdate.nekiim_show_calendar = nekiim_show_calendar;
    if (lang !== undefined) settingsUpdate.lang = lang;

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
      nekiim_reminder: !!user.nekiim_reminder,
      nekiim_show_calendar: !!user.nekiim_show_calendar,
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

/**
 * GET /api/settings/donation-check
 * Check if donation prompt should be shown to current user.
 */
router.get('/donation-check', (req, res) => {
  try {
    if (process.env.DONATION_PROMPT === 'false') {
      return res.json({ show: false });
    }
    const user = db.prepare('SELECT last_donation_prompt, donated_at, created_at FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.json({ show: false });

    const now = new Date();
    const SIX_MONTHS = 180 * 24 * 60 * 60 * 1000;
    const THREE_YEARS = 3 * 365 * 24 * 60 * 60 * 1000;

    // If donated: show again after 3 years
    if (user.donated_at) {
      const donatedDate = new Date(user.donated_at);
      if (now - donatedDate < THREE_YEARS) return res.json({ show: false });
    }

    // If never prompted: show (new user)
    if (!user.last_donation_prompt) return res.json({ show: true });

    // Otherwise: show after 6 months since last prompt
    const lastPrompt = new Date(user.last_donation_prompt);
    if (now - lastPrompt >= SIX_MONTHS) return res.json({ show: true });

    return res.json({ show: false });
  } catch (err) {
    return res.json({ show: false });
  }
});

/**
 * POST /api/settings/donation-prompt
 * Record that the donation prompt was shown (dismiss) or that user donated.
 * Body: { action: "dismissed" | "donated" }
 */
router.post('/donation-prompt', (req, res) => {
  try {
    const { action } = req.body;
    const now = new Date().toISOString();

    if (action === 'donated') {
      db.prepare('UPDATE users SET donated_at = ?, last_donation_prompt = ? WHERE id = ?').run(now, now, req.userId);
    } else {
      db.prepare('UPDATE users SET last_donation_prompt = ? WHERE id = ?').run(now, req.userId);
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
