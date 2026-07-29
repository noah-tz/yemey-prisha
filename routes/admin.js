'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');
const db = require('../db');

// All admin routes require auth + admin
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * System-wide statistics.
 */
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    const totalCycles = db.prepare('SELECT COUNT(*) as count FROM user_data').get().count;
    const recentUsers = db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE created_at > datetime("now", "-7 days")'
    ).get().count;

    // Get DB file size via pragma
    const pageCount = db.pragma('page_count', { simple: true });
    const pageSize = db.pragma('page_size', { simple: true });
    const dbSizeBytes = (pageCount || 0) * (pageSize || 0);

    return res.json({
      total_users: totalUsers,
      active_sessions: totalSessions,
      users_with_data: totalCycles,
      new_users_7d: recentUsers,
      db_size_bytes: dbSizeBytes
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users
 * List all users with basic info (no sensitive data).
 */
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.is_admin,
        u.created_at,
        u.reminder_enabled,
        CASE WHEN ud.user_id IS NOT NULL THEN 1 ELSE 0 END as has_data,
        (SELECT COUNT(*) FROM sessions s WHERE s.sess LIKE '%"userId":' || u.id || '%' OR s.sess LIKE '%"userId",' || u.id || '%') as session_count
      FROM users u
      LEFT JOIN user_data ud ON ud.user_id = u.id
      ORDER BY u.created_at DESC
    `).all();

    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and all their data. Cannot delete yourself or other admins.
 */
router.delete('/users/:id', (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = db.prepare('SELECT id, email, is_admin FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.is_admin) {
      return res.status(400).json({ error: 'Cannot delete an admin user' });
    }

    // Delete all related data
    db.prepare('DELETE FROM user_data WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM mechitzot WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM veset_dates WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM cycle_records WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM reminder_emails WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM consent_log WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

    return res.json({ message: 'User deleted', email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/users/:id/admin
 * Toggle admin status. Only the first user (system owner) can do this.
 * Body: { is_admin: true/false }
 */
router.put('/users/:id/admin', (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { is_admin } = req.body;

    // Only the first registered user (lowest ID) can toggle admin
    const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    if (!firstUser || req.userId !== firstUser.id) {
      return res.status(403).json({ error: 'Only the system owner can manage admins' });
    }

    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own admin status' });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, targetId);
    return res.json({ message: is_admin ? 'Admin granted' : 'Admin revoked', email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/registration
 * Get current registration status.
 */
router.get('/registration', (req, res) => {
  const allowReg = process.env.ALLOW_REGISTRATION === 'true';
  return res.json({ allow_registration: allowReg });
});

/**
 * PUT /api/admin/registration
 * Toggle registration open/closed. Updates the env variable at runtime.
 * Body: { allow: true/false }
 */
router.put('/registration', (req, res) => {
  try {
    const { allow } = req.body;
    process.env.ALLOW_REGISTRATION = allow ? 'true' : 'false';
    return res.json({ allow_registration: allow, message: allow ? 'Registration opened' : 'Registration closed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
