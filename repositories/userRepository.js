const db = require('../db');
const crypto = require('crypto');

const SETTINGS_COLUMNS = 'id, email, posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow, reminder_enabled, reminder_email, nekiim_reminder, nekiim_show_calendar, latitude, longitude, is_admin, created_at';

/**
 * Create a new user and return the user object (without password_hash).
 * @param {string} email
 * @param {string} passwordHash
 * @param {string} [encSalt] - hex-encoded encryption salt
 * @param {string} [encKeyEncrypted] - wrapped encryption key for API/cron access
 * @returns {Object}
 */
function create(email, passwordHash, encSalt, encKeyEncrypted) {
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash, enc_salt, enc_key_encrypted) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(email, passwordHash, encSalt || null, encKeyEncrypted || null);

  return db.prepare(
    `SELECT ${SETTINGS_COLUMNS} FROM users WHERE id = ?`
  ).get(result.lastInsertRowid);
}

/**
 * Find a user by email. Returns the full row including password_hash and enc fields (for auth).
 * @param {string} email
 * @returns {Object|undefined}
 */
function findByEmail(email) {
  const stmt = db.prepare(
    `SELECT id, email, password_hash, enc_salt, enc_key_encrypted, posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow, created_at FROM users WHERE email = ?`
  );
  return stmt.get(email);
}

/**
 * Find a user by ID. Returns user without password_hash.
 * @param {number} id
 * @returns {Object|undefined}
 */
function findById(id) {
  const stmt = db.prepare(
    `SELECT ${SETTINGS_COLUMNS} FROM users WHERE id = ?`
  );
  return stmt.get(id);
}

/**
 * Update the posek preference for a user.
 * @param {number} userId
 * @param {'rama' | 'mechaber'} posek
 * @returns {Object}
 * @throws {Error} If posek is not 'rama' or 'mechaber'
 */
function updatePosek(userId, posek) {
  if (posek !== 'rama' && posek !== 'mechaber') {
    throw new Error("Invalid posek value. Must be 'rama' or 'mechaber'.");
  }

  const stmt = db.prepare(
    'UPDATE users SET posek = ? WHERE id = ?'
  );
  stmt.run(posek, userId);

  return findById(userId);
}

/**
 * Update multiple settings for a user.
 * Accepts an object with any subset of: { posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow }
 * @param {number} userId
 * @param {Object} settings
 * @returns {Object} updated user
 */
function updateSettings(userId, settings) {
  const allowedFields = ['posek', 'onah_beinonit_31', 'or_zarua', 'haflagah_shlishit', 'hachodesh_overflow', 'reminder_enabled', 'reminder_email', 'latitude', 'longitude', 'nekiim_reminder', 'nekiim_show_calendar'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(settings, field)) {
      let val = settings[field];
      // Validate posek
      if (field === 'posek') {
        if (val !== 'rama' && val !== 'mechaber') {
          throw new Error("Invalid posek value. Must be 'rama' or 'mechaber'.");
        }
      } else if (field === 'reminder_email') {
        // String field — store as-is (empty string becomes null)
        val = val || null;
      } else if (field === 'latitude' || field === 'longitude') {
        // Numeric float fields
        val = val !== null && val !== undefined ? parseFloat(val) : null;
      } else {
        // Boolean fields stored as INTEGER 0/1
        val = val ? 1 : 0;
      }
      setClauses.push(`${field} = ?`);
      values.push(val);
    }
  }

  if (setClauses.length === 0) {
    return findById(userId);
  }

  values.push(userId);
  const stmt = db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return findById(userId);
}

/**
 * Find a user by API key. Returns user without password_hash but with enc_key_encrypted.
 * @param {string} apiKey
 * @returns {Object|undefined}
 */
function findByApiKey(apiKey) {
  if (!apiKey) return undefined;
  const stmt = db.prepare(
    `SELECT ${SETTINGS_COLUMNS}, enc_key_encrypted FROM users WHERE api_key = ?`
  );
  return stmt.get(apiKey);
}

/**
 * Generate (or regenerate) an API key for a user.
 * @param {number} userId
 * @returns {string} the new API key
 */
function generateApiKey(userId) {
  const key = 'vst_' + crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(key, userId);
  return key;
}

/**
 * Get the current API key for a user (or null if not generated).
 * @param {number} userId
 * @returns {string|null}
 */
function getApiKey(userId) {
  const row = db.prepare('SELECT api_key FROM users WHERE id = ?').get(userId);
  return row ? row.api_key : null;
}

/**
 * Update encryption fields for a user (enc_salt and enc_key_encrypted).
 * @param {number} userId
 * @param {string} encSalt - hex-encoded salt
 * @param {string} encKeyEncrypted - wrapped encryption key
 */
function updateEncryption(userId, encSalt, encKeyEncrypted) {
  db.prepare('UPDATE users SET enc_salt = ?, enc_key_encrypted = ? WHERE id = ?')
    .run(encSalt, encKeyEncrypted, userId);
}

module.exports = {
  create,
  findByEmail,
  findById,
  updatePosek,
  updateSettings,
  findByApiKey,
  generateApiKey,
  getApiKey,
  updateEncryption,
};
