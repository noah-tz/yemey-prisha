'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const mechitzaRepository = require('../repositories/mechitzaRepository');
const { recalculateVestot } = require('../services/cycleService');

router.use(requireAuth);

/**
 * GET /api/mechitzot
 * List all mechitzot for the authenticated user (decrypted).
 */
router.get('/', (req, res) => {
  try {
    const mechitzot = mechitzaRepository.findByUserDecrypted(req.userId, req.encKey);
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
    mechitzaRepository.create(req.userId, afterRecordId, description, req.encKey);
    recalculateVestot(req.userId, req.encKey);
    return res.status(201).json({ message: 'Mechitza created' });
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
    mechitzaRepository.deleteById(req.userId, id);
    recalculateVestot(req.userId, req.encKey);
    return res.json({ message: 'Mechitza removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
