'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const cycleService = require('../services/cycleService');
const HebrewDateUtils = require('../services/hebrewDateUtils');
const { getSunTimes } = require('../services/sunTimes');
const db = require('../db');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/vestot
 * Get all calculated yemey prisha for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const vestot = cycleService.getVestot(req.userId, req.encKey);
    const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(req.userId);
    return res.json({ vestot: formatVestot(vestot, user ? user.latitude : null, user ? user.longitude : null) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/vestot/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get vestot for a specific date range.
 */
router.get('/calendar', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }
    const fromRd = HebrewDateUtils.greg2rd(new Date(from));
    const toRd = HebrewDateUtils.greg2rd(new Date(to));

    const filtered = cycleService.getVestotByDateRange(req.userId, req.encKey, fromRd, toRd);
    const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(req.userId);

    // Also get cycles in range for showing re'iyot
    const history = cycleService.getHistory(req.userId, req.encKey);
    const cyclesInRange = history.filter(c => c.start_rd >= fromRd && c.start_rd <= toRd);

    return res.json({ 
      vestot: formatVestot(filtered, user ? user.latitude : null, user ? user.longitude : null),
      cycles: cyclesInRange.map(c => ({
        id: c.id,
        date: c.start_date,
        hebrewDate: { year: c.start_heb_year, month: c.start_heb_month, day: c.start_heb_day },
        onah: c.onah
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function formatVestot(vestot, lat, lng) {
  return vestot.map(v => {
    const result = {
      id: v.id,
      type: v.type,
      date: v.date,
      hebrewDate: { year: v.heb_year, month: v.heb_month, day: v.heb_day },
      onah: v.onah,
      isOrZarua: !!v.is_or_zarua,
      isKavua: !!v.is_kavua,
      sourceRecordId: v.source_record_id
    };
    // Add sunset/sunrise times if date and location are available
    if (v.date && lat && lng) {
      const times = getSunTimes(new Date(v.date), lat, lng);
      result.sunset = times.sunset;
      result.sunrise = times.sunrise;
    }
    return result;
  });
}

module.exports = router;
