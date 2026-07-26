'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const cycleService = require('../services/cycleService');

// All routes require authentication
router.use(requireAuth);

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

module.exports = router;
