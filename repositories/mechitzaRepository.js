'use strict';

const db = require('../db');
const cryptoService = require('../services/crypto');

function create(userId, afterRecordId, description, encKey) {
  const encRecordId = encKey ? cryptoService.encrypt(String(afterRecordId), encKey) : String(afterRecordId);
  const encDescription = (encKey && description) ? cryptoService.encrypt(description, encKey) : (description || null);

  const stmt = db.prepare(
    'INSERT INTO mechitzot (user_id, after_record_id, description) VALUES (?, ?, ?)'
  );
  const result = stmt.run(userId, encRecordId, encDescription);
  return db.prepare('SELECT * FROM mechitzot WHERE id = ?').get(result.lastInsertRowid);
}

function deleteById(userId, id) {
  const stmt = db.prepare('DELETE FROM mechitzot WHERE user_id = ? AND id = ?');
  return stmt.run(userId, id);
}

function findByUser(userId) {
  return db.prepare('SELECT * FROM mechitzot WHERE user_id = ? ORDER BY id ASC').all(userId);
}

/**
 * Get decrypted mechitza after_record_ids for a user.
 * Returns an array of integer record IDs.
 */
function getDecryptedAfterIds(userId, encKey) {
  const rows = findByUser(userId);
  return rows.map(row => {
    if (encKey && row.after_record_id && row.after_record_id.includes(':')) {
      try {
        return parseInt(cryptoService.decrypt(row.after_record_id, encKey), 10);
      } catch(e) {
        return parseInt(row.after_record_id, 10); // fallback for plaintext
      }
    }
    return parseInt(row.after_record_id, 10);
  }).filter(id => !isNaN(id));
}

/**
 * Get decrypted mechitzot for display (with decrypted description).
 */
function findByUserDecrypted(userId, encKey) {
  const rows = findByUser(userId);
  return rows.map(row => {
    let afterRecordId = row.after_record_id;
    let description = row.description;

    if (encKey) {
      if (afterRecordId && afterRecordId.includes(':')) {
        try { afterRecordId = parseInt(cryptoService.decrypt(afterRecordId, encKey), 10); } catch(e) { afterRecordId = parseInt(afterRecordId, 10); }
      } else {
        afterRecordId = parseInt(afterRecordId, 10);
      }
      if (description && description.includes(':')) {
        try { description = cryptoService.decrypt(description, encKey); } catch(e) {}
      }
    } else {
      afterRecordId = parseInt(afterRecordId, 10);
    }

    return { ...row, after_record_id: afterRecordId, description };
  });
}

module.exports = { create, deleteById, findByUser, getDecryptedAfterIds, findByUserDecrypted };
