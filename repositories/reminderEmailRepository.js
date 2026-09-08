'use strict';

const db = require('../db');
const crypto = require('crypto');

function addEmail(userId, email) {
  // Check if already exists for this user
  const existing = db.prepare(
    'SELECT * FROM reminder_emails WHERE user_id = ? AND email = ?'
  ).get(userId, email);
  if (existing) {
    if (existing.verified) throw new Error('כתובת זו כבר מאומתת');
    // Re-generate token for resend
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE reminder_emails SET verify_token = ?, token_expires = ? WHERE id = ?')
      .run(token, expires, existing.id);
    return { ...existing, verify_token: token, token_expires: expires };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare(
    'INSERT INTO reminder_emails (user_id, email, verify_token, token_expires) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(userId, email, token, expires);
  return db.prepare('SELECT * FROM reminder_emails WHERE id = ?').get(result.lastInsertRowid);
}

function verifyToken(token) {
  const row = db.prepare(
    'SELECT * FROM reminder_emails WHERE verify_token = ?'
  ).get(token);
  if (!row) return null;

  // Check expiry
  if (new Date(row.token_expires) < new Date()) {
    return null; // expired
  }

  // Mark as verified
  db.prepare(
    'UPDATE reminder_emails SET verified = 1, verify_token = NULL, token_expires = NULL WHERE id = ?'
  ).run(row.id);

  return db.prepare('SELECT * FROM reminder_emails WHERE id = ?').get(row.id);
}

function findVerifiedByUser(userId) {
  return db.prepare(
    'SELECT id, email, created_at FROM reminder_emails WHERE user_id = ? AND verified = 1'
  ).all(userId);
}

function findAllByUser(userId) {
  return db.prepare(
    'SELECT id, email, verified, created_at FROM reminder_emails WHERE user_id = ?'
  ).all(userId);
}

function deleteEmail(userId, emailId) {
  return db.prepare(
    'DELETE FROM reminder_emails WHERE user_id = ? AND id = ?'
  ).run(userId, emailId);
}

module.exports = { addEmail, verifyToken, findVerifiedByUser, findAllByUser, deleteEmail };
