const db = require('../db');

/**
 * Save all veset dates for a user in a single transaction.
 * @param {number} userId
 * @param {Array<Object>} vestot
 */
function saveAll(userId, vestot) {
  const insert = db.prepare(
    `INSERT INTO veset_dates (user_id, source_record_id, type, date, date_rd, heb_year, heb_month, heb_day, onah, is_or_zarua, enc_heb)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction((items) => {
    for (const v of items) {
      insert.run(
        userId,
        v.source_record_id,
        v.type,
        v.date,
        v.date_rd,
        v.heb_year,
        v.heb_month,
        v.heb_day,
        v.onah,
        v.is_or_zarua || 0,
        v.enc_heb || null
      );
    }
  });

  transaction(vestot);
}

/**
 * Delete all veset dates for a user.
 * @param {number} userId
 */
function deleteByUser(userId) {
  const stmt = db.prepare('DELETE FROM veset_dates WHERE user_id = ?');
  stmt.run(userId);
}

/**
 * Find all veset dates for a user, ordered by date_rd ascending.
 * @param {number} userId
 * @returns {Array<Object>}
 */
function findByUser(userId) {
  const stmt = db.prepare(
    'SELECT * FROM veset_dates WHERE user_id = ? ORDER BY date_rd ASC'
  );
  return stmt.all(userId);
}

/**
 * Find veset dates for a user within a Rata Die date range, ordered by date_rd ascending.
 * @param {number} userId
 * @param {number} fromRd - Start of range (inclusive)
 * @param {number} toRd - End of range (inclusive)
 * @returns {Array<Object>}
 */
function findByDateRange(userId, fromRd, toRd) {
  const stmt = db.prepare(
    'SELECT * FROM veset_dates WHERE user_id = ? AND date_rd >= ? AND date_rd <= ? ORDER BY date_rd ASC'
  );
  return stmt.all(userId, fromRd, toRd);
}

module.exports = {
  saveAll,
  deleteByUser,
  findByUser,
  findByDateRange,
};
