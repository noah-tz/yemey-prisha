const db = require('../db');

/**
 * Create a new cycle record for a user.
 * @param {number} userId
 * @param {{ start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: 'day'|'night', end_date?: string }} record
 * @returns {{ id: number, user_id: number, start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: string, end_date: string|null, created_at: string }}
 */
function create(userId, record) {
  const stmt = db.prepare(`
    INSERT INTO cycle_records (user_id, start_date, start_rd, start_heb_year, start_heb_month, start_heb_day, onah, end_date, enc_heb)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    userId,
    record.start_date,
    record.start_rd,
    record.start_heb_year,
    record.start_heb_month,
    record.start_heb_day,
    record.onah,
    record.end_date || null,
    record.enc_heb || null
  );

  return db.prepare(
    'SELECT * FROM cycle_records WHERE id = ?'
  ).get(result.lastInsertRowid);
}

/**
 * Update an existing cycle record. Only provided fields are updated.
 * @param {number} userId
 * @param {number} id
 * @param {{ start_date?: string, start_rd?: number, start_heb_year?: number, start_heb_month?: number, start_heb_day?: number, onah?: 'day'|'night', end_date?: string|null }} updates
 * @returns {{ id: number, user_id: number, start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: string, end_date: string|null, created_at: string } | undefined}
 */
function update(userId, id, updates) {
  const allowedFields = ['start_date', 'start_rd', 'start_heb_year', 'start_heb_month', 'start_heb_day', 'onah', 'end_date', 'enc_heb'];
  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      setClauses.push(`${field} = ?`);
      values.push(updates[field] !== undefined ? updates[field] : null);
    }
  }

  if (setClauses.length === 0) {
    return findById(userId, id);
  }

  values.push(userId, id);

  const stmt = db.prepare(`
    UPDATE cycle_records SET ${setClauses.join(', ')}
    WHERE user_id = ? AND id = ?
  `);
  stmt.run(...values);

  return findById(userId, id);
}

/**
 * Delete a cycle record by user and id.
 * @param {number} userId
 * @param {number} id
 * @returns {{ deleted: boolean }}
 */
function deleteRecord(userId, id) {
  const stmt = db.prepare(
    'DELETE FROM cycle_records WHERE user_id = ? AND id = ?'
  );
  const result = stmt.run(userId, id);
  return { deleted: result.changes > 0 };
}

/**
 * Find all cycle records for a user, ordered by start_rd ascending.
 * @param {number} userId
 * @returns {Array<{ id: number, user_id: number, start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: string, end_date: string|null, created_at: string }>}
 */
function findByUser(userId) {
  const stmt = db.prepare(
    'SELECT * FROM cycle_records WHERE user_id = ? ORDER BY start_rd ASC'
  );
  return stmt.all(userId);
}

/**
 * Find a single cycle record by user and id.
 * @param {number} userId
 * @param {number} id
 * @returns {{ id: number, user_id: number, start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: string, end_date: string|null, created_at: string } | undefined}
 */
function findById(userId, id) {
  const stmt = db.prepare(
    'SELECT * FROM cycle_records WHERE user_id = ? AND id = ?'
  );
  return stmt.get(userId, id);
}

/**
 * Find records that overlap with the given start date.
 * A record is considered overlapping if it has the same start_rd for this user.
 * @param {number} userId
 * @param {number} startRd - The Rata Die value to check for conflicts
 * @param {number|null} endRd - Optional end Rata Die (reserved for future range-based overlap checking)
 * @returns {Array<{ id: number, user_id: number, start_date: string, start_rd: number, start_heb_year: number, start_heb_month: number, start_heb_day: number, onah: string, end_date: string|null, created_at: string }>}
 */
function findOverlapping(userId, startRd, endRd) {
  const stmt = db.prepare(
    'SELECT * FROM cycle_records WHERE user_id = ? AND start_rd = ?'
  );
  return stmt.all(userId, startRd);
}

/**
 * Update the enc_heb column for a cycle record.
 * @param {number} recordId
 * @param {string} encHeb - encrypted Hebrew date bundle
 */
function updateEncHeb(recordId, encHeb) {
  db.prepare('UPDATE cycle_records SET enc_heb = ? WHERE id = ?').run(encHeb, recordId);
}

module.exports = {
  create,
  update,
  delete: deleteRecord,
  findByUser,
  findById,
  findOverlapping,
  updateEncHeb,
};
