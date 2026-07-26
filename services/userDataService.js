'use strict';

const db = require('../db');
const cryptoService = require('./crypto');

/**
 * Load and decrypt user data blob.
 * Returns the full data object or a fresh empty one.
 * @param {number} userId
 * @param {Buffer} encKey
 * @returns {Object} { cycles, vestot, mechitzot, next_cycle_id, next_veset_id }
 */
function loadUserData(userId, encKey) {
  const row = db.prepare('SELECT encrypted_blob FROM user_data WHERE user_id = ?').get(userId);
  if (!row) {
    return { cycles: [], vestot: [], mechitzot: [], next_cycle_id: 1, next_veset_id: 1 };
  }
  try {
    const json = cryptoService.decrypt(row.encrypted_blob, encKey);
    return JSON.parse(json);
  } catch (e) {
    // Decryption failed — return empty
    return { cycles: [], vestot: [], mechitzot: [], next_cycle_id: 1, next_veset_id: 1 };
  }
}

/**
 * Encrypt and save user data blob.
 * @param {number} userId
 * @param {Object} data - { cycles, vestot, mechitzot, next_cycle_id, next_veset_id }
 * @param {Buffer} encKey
 */
function saveUserData(userId, data, encKey) {
  const json = JSON.stringify(data);
  const encrypted = cryptoService.encrypt(json, encKey);

  const existing = db.prepare('SELECT user_id FROM user_data WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_data SET encrypted_blob = ? WHERE user_id = ?')
      .run(encrypted, userId);
  } else {
    db.prepare('INSERT INTO user_data (user_id, encrypted_blob) VALUES (?, ?)')
      .run(userId, encrypted);
  }
}

module.exports = { loadUserData, saveUserData };
