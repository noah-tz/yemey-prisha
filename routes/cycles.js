'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const cycleService = require('../services/cycleService');

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/cycles/nekiim
 * Get all nekiim countdowns for the user.
 */
router.get('/nekiim', (req, res) => {
  try {
    const { loadUserData } = require('../services/userDataService');
    const data = loadUserData(req.userId, req.encKey);
    return res.json({ nekiim: data.nekiim || [] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/cycles/export
 * Export all user data as JSON (for backup).
 */
router.get('/export', (req, res) => {
  try {
    const history = cycleService.getHistory(req.userId, req.encKey);
    const vestot = cycleService.getVestot(req.userId, req.encKey);
    const mechitzot = cycleService.getMechitzot(req.userId, req.encKey);
    
    const exportData = {
      exported_at: new Date().toISOString(),
      cycles: history,
      vestot: vestot,
      mechitzot: mechitzot
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="luach-vestot-backup.json"');
    return res.json(exportData);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/cycles
 * List all cycle records for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const history = cycleService.getHistory(req.userId, req.encKey);
    return res.json({ records: history });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/cycles
 * Create a new cycle record.
 * Body: { startDate?, startDateHeb?, onah, endDate?, inputFormat }
 */
router.post('/', (req, res) => {
  try {
    const { startDate, startDateHeb, onah, endDate, inputFormat } = req.body;

    // Validate required fields
    if (!onah || (onah !== 'day' && onah !== 'night')) {
      return res.status(400).json({ error: "onah must be 'day' or 'night'" });
    }

    const format = inputFormat || 'gregorian';
    if (format === 'hebrew' && !startDateHeb) {
      return res.status(400).json({ error: 'startDateHeb is required for Hebrew input format' });
    }
    if (format === 'gregorian' && !startDate) {
      return res.status(400).json({ error: 'startDate is required for Gregorian input format' });
    }

    const record = cycleService.createRecord(req.userId, {
      startDate,
      startDateHeb,
      onah,
      endDate,
      inputFormat: format
    }, req.encKey);

    return res.status(201).json(record);
  } catch (err) {
    if (err.message === 'Date conflicts with existing cycle record') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/cycles/import
 * Bulk import multiple cycle records.
 * Body: { records: [{ startDate: "YYYY-MM-DD", onah: "day"|"night", endDate?: "YYYY-MM-DD" }] }
 */
router.post('/import', (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records must be an array' });
    }
    if (records.length === 0) {
      return res.status(400).json({ error: 'records array is empty' });
    }
    if (records.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 records per import' });
    }

    const result = cycleService.importRecords(req.userId, records, req.encKey);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/cycles/:id
 * Update an existing cycle record.
 */
router.put('/:id', (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      return res.status(400).json({ error: 'Invalid record ID' });
    }

    const updated = cycleService.updateRecord(req.userId, recordId, req.body, req.encKey);
    return res.json(updated);
  } catch (err) {
    if (err.message === 'Record not found') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/cycles/:id
 * Delete a cycle record.
 */
router.delete('/:id', (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      return res.status(400).json({ error: 'Invalid record ID' });
    }

    cycleService.deleteRecord(req.userId, recordId, req.encKey);
    return res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    if (err.message === 'Record not found') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/cycles/:id/nekiim
 * Start counting 7 nekiim for a cycle.
 * Body: { startDate: "YYYY-MM-DD" } OR { hefsekHeb: { year, month, day } }
 * The 7 nekiim start the day AFTER the hefsek.
 * Tevilah night = hefsek + 8 days.
 * Only one active (non-completed) nekiim count is allowed at a time.
 */
router.post('/:id/nekiim', (req, res) => {
  try {
    const cycleId = parseInt(req.params.id, 10);
    const { startDate, hefsekHeb } = req.body;

    const HebrewDateUtils = require('../services/hebrewDateUtils');
    const { loadUserData, saveUserData } = require('../services/userDataService');
    const data = loadUserData(req.userId, req.encKey);

    if (!data.nekiim) data.nekiim = [];

    // Enforce single count — remove ALL previous nekiim (including completed)
    data.nekiim = [];

    let hefsekRd;
    let hefsekDateStr;
    if (hefsekHeb && hefsekHeb.year && hefsekHeb.month && hefsekHeb.day) {
      // Hebrew date input
      hefsekRd = HebrewDateUtils.heb2rd({ year: hefsekHeb.year, month: hefsekHeb.month, day: hefsekHeb.day });
      const gregDate = HebrewDateUtils.rd2greg(hefsekRd);
      hefsekDateStr = gregDate.getFullYear() + '-' + String(gregDate.getMonth()+1).padStart(2,'0') + '-' + String(gregDate.getDate()).padStart(2,'0');
    } else if (startDate) {
      hefsekRd = HebrewDateUtils.greg2rd(new Date(startDate));
      hefsekDateStr = startDate;
    } else {
      return res.status(400).json({ error: 'startDate or hefsekHeb is required' });
    }

    const firstNakiRd = hefsekRd + 1; // Day after hefsek
    const tevilahRd = hefsekRd + 8; // Night of 8th day
    const hefsekHebObj = HebrewDateUtils.rd2heb(hefsekRd);
    const tevilahHeb = HebrewDateUtils.rd2heb(tevilahRd);
    const tevilahGreg = HebrewDateUtils.rd2greg(tevilahRd);

    const nekiim = {
      id: Date.now(),
      cycle_id: cycleId,
      hefsek_date: hefsekDateStr,
      hefsek_rd: hefsekRd,
      hefsek_heb: hefsekHebObj,
      first_naki_rd: firstNakiRd,
      tevilah_rd: tevilahRd,
      tevilah_date: tevilahGreg.getFullYear() + '-' + String(tevilahGreg.getMonth()+1).padStart(2,'0') + '-' + String(tevilahGreg.getDate()).padStart(2,'0'),
      tevilah_heb: tevilahHeb,
      // 14 checks: pairs of [night, day] for each of the 7 days
      days: [
        { night: false, day: false },
        { night: false, day: false },
        { night: false, day: false },
        { night: false, day: false },
        { night: false, day: false },
        { night: false, day: false },
        { night: false, day: false }
      ],
      completed: false
    };

    data.nekiim.push(nekiim);
    saveUserData(req.userId, data, req.encKey);
    return res.status(201).json(nekiim);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/cycles/:id/nekiim/:nekiimId
 * Update a nekiim day (mark as clean or not).
 * Body: { day: 0-6, onah: "night"|"day", clean: true/false }
 */
router.put('/:id/nekiim/:nekiimId', (req, res) => {
  try {
    const nekiimId = parseInt(req.params.nekiimId, 10);
    const { day, onah, clean } = req.body;
    if (day === undefined || day < 0 || day > 6) return res.status(400).json({ error: 'day must be 0-6' });
    if (!onah || (onah !== 'night' && onah !== 'day')) return res.status(400).json({ error: "onah must be 'night' or 'day'" });

    const { loadUserData, saveUserData } = require('../services/userDataService');
    const data = loadUserData(req.userId, req.encKey);
    if (!data.nekiim) return res.status(404).json({ error: 'Not found' });

    const nekiim = data.nekiim.find(n => n.id === nekiimId);
    if (!nekiim) return res.status(404).json({ error: 'Not found' });

    // Migrate old format (array of booleans) to new format (array of objects)
    if (Array.isArray(nekiim.days) && typeof nekiim.days[0] === 'boolean') {
      nekiim.days = nekiim.days.map(function(d) { return { night: d, day: d }; });
    }

    nekiim.days[day][onah] = !!clean;
    // Completed when all 14 checks are true
    nekiim.completed = nekiim.days.every(d => d.night && d.day);

    saveUserData(req.userId, data, req.encKey);
    return res.json(nekiim);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/cycles/:id/nekiim/:nekiimId
 * Cancel/delete a nekiim count.
 */
router.delete('/:id/nekiim/:nekiimId', (req, res) => {
  try {
    const nekiimId = parseInt(req.params.nekiimId, 10);

    const { loadUserData, saveUserData } = require('../services/userDataService');
    const data = loadUserData(req.userId, req.encKey);
    if (!data.nekiim) return res.status(404).json({ error: 'Not found' });

    const idx = data.nekiim.findIndex(n => n.id === nekiimId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    data.nekiim.splice(idx, 1);
    saveUserData(req.userId, data, req.encKey);
    return res.json({ message: 'Nekiim count deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
