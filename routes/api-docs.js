'use strict';

const express = require('express');
const router = express.Router();

/**
 * GET /api/docs
 * Returns available API endpoints and authentication instructions.
 * This endpoint is public (no auth required).
 */
router.get('/', (req, res) => {
  res.json({
    name: 'Luach Vestot API',
    version: '1.0.0',
    authentication: {
      method: 'API Key',
      header: 'X-API-Key: <your-key>',
      alternative: 'Authorization: Bearer <your-key>',
      getKey: 'Login to the app → Settings → Generate API Key'
    },
    endpoints: {
      cycles: {
        'GET /api/cycles': 'List all cycle records',
        'POST /api/cycles': 'Create a new cycle record. Body: { startDate, onah, endDate?, inputFormat? }',
        'PUT /api/cycles/:id': 'Update a cycle record',
        'DELETE /api/cycles/:id': 'Delete a cycle record'
      },
      vestot: {
        'GET /api/vestot': 'Get all calculated yemey prisha',
        'GET /api/vestot/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD': 'Get vestot for date range'
      },
      settings: {
        'GET /api/settings': 'Get user settings',
        'PUT /api/settings': 'Update settings. Body: { posek?, onah_beinonit_31?, or_zarua?, haflagah_shlishit?, hachodesh_overflow? }',
        'GET /api/settings/api-key': 'Get current API key',
        'POST /api/settings/api-key': 'Generate or regenerate API key'
      }
    }
  });
});

module.exports = router;
