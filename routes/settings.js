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
      hachodesh_overflow: !!user.hachodesh_overflow
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
    const { posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow } = req.body;

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

    if (Object.keys(settingsUpdate).length === 0) {
      return res.status(400).json({ error: 'No settings provided' });
    }

    userRepository.updateSettings(req.userId, settingsUpdate);

    // Recalculate all vestot with new settings (encryption-aware)
    cycleService.recalculateVestot(req.userId, req.encKey);

    // Get updated user for response
    const user = userRepository.findById(req.userId);

    return res.json({
      posek: user.posek,
      onah_beinonit_31: !!user.onah_beinonit_31,
      or_zarua: !!user.or_zarua,
      haflagah_shlishit: !!user.haflagah_shlishit,
      hachodesh_overflow: !!user.hachodesh_overflow,
      message: 'Settings updated, vestot recalculated'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
