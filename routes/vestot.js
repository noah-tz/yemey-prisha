'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const vesetRepository = require('../repositories/vesetRepository');
const HebrewDateUtils = require('../services/hebrewDateUtils');
const { decryptVesetDate } = require('../services/encryptionHelpers');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/vestot
 * Get all calculated yemey prisha for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const vestot = vesetRepository.findByUser(req.userId);
    const decrypted = vestot.map(v => decryptVesetDate(v, req.encKey));
    return res.json({ vestot: formatVestot(decrypted) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/vestot/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get vestot for a specific date range.
 * Since date_rd is now encrypted (stored as 0), we fetch ALL vestot,
 * decrypt them, then filter by date range in-memory.
 */
router.get('/calendar', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }
    const fromRd = HebrewDateUtils.greg2rd(new Date(from));
    const toRd = HebrewDateUtils.greg2rd(new Date(to));

    // Fetch ALL vestot for user (can't query by encrypted date_rd)
    const allVestot = vesetRepository.findByUser(req.userId);
    const decrypted = allVestot.map(v => decryptVesetDate(v, req.encKey));

    // Filter by date range in-memory using decrypted date_rd
    const filtered = decrypted.filter(v => {
      const rd = v.date_rd;
      return rd >= fromRd && rd <= toRd;
    });

    return res.json({ vestot: formatVestot(filtered) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function formatVestot(vestot) {
  return vestot.map(v => ({
    id: v.id,
    type: v.type,
    date: v.date,
    hebrewDate: { year: v.heb_year, month: v.heb_month, day: v.heb_day },
    onah: v.onah,
    isOrZarua: !!v.is_or_zarua,
    sourceRecordId: v.source_record_id
  }));
}

module.exports = router;
