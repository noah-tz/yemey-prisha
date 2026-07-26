'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const cycleService = require('../services/cycleService');

router.use(requireAuth);

/**
 * GET /api/mechitzot
 * List all mechitzot for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const mechitzot = cycleService.getMechitzot(req.userId, req.encKey);
    return res.json({ mechitzot });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mechitzot
 * Create a new mechitza after a specific record.
 * Body: { afterRecordId, description? }
 */
router.post('/', (req, res) => {
  try {
    const { afterRecordId, description } = req.body;
    if (!afterRecordId) {
      return res.status(400).json({ error: 'afterRecordId is required' });
    }
    const mechitza = cycleService.addMechitza(req.userId, afterRecordId, description, req.encKey);
    return res.status(201).json({ message: 'Mechitza created', mechitza });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/mechitzot/:id
 * Remove a mechitza.
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    cycleService.removeMechitza(req.userId, id, req.encKey);
    return res.json({ message: 'Mechitza removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
