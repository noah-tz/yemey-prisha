'use strict';

const db = require('../db');
const { encryptCycleRecord, decryptCycleRecord, encryptVesetDate } = require('./encryptionHelpers');
const cycleRepository = require('../repositories/cycleRepository');
const vesetRepository = require('../repositories/vesetRepository');

/**
 * Migrate existing plaintext records for a user to encrypted form.
 * Should be called once after user first logs in with the new encryption system.
 * Safe to call multiple times — only encrypts records that aren't already encrypted.
 *
 * @param {number} userId
 * @param {Buffer} encKey - the user's encryption key
 * @returns {{ cyclesEncrypted: number, vestotsEncrypted: number }}
 */
function migrateUserRecords(userId, encKey) {
  if (!encKey) return { cyclesEncrypted: 0, vestotsEncrypted: 0 };

  let cyclesEncrypted = 0;
  let vestotsEncrypted = 0;

  // Encrypt plaintext cycle records
  const cycles = cycleRepository.findByUser(userId);
  for (const record of cycles) {
    // Check if already encrypted (encrypted dates contain ':')
    if (record.start_date && record.start_date.includes(':')) continue;

    const encrypted = encryptCycleRecord(record, encKey);
    // Update with encrypted values
    db.prepare(`
      UPDATE cycle_records
      SET start_date = ?, onah = ?, start_heb_year = ?, start_heb_month = ?, start_heb_day = ?, enc_heb = ?
      WHERE id = ?
    `).run(
      encrypted.start_date,
      encrypted.onah,
      encrypted.start_heb_year,
      encrypted.start_heb_month,
      encrypted.start_heb_day,
      encrypted.enc_heb,
      record.id
    );
    cyclesEncrypted++;
  }

  // Encrypt plaintext veset dates
  const vestot = vesetRepository.findByUser(userId);
  for (const veset of vestot) {
    if (veset.date && veset.date.includes(':')) continue;

    const encrypted = encryptVesetDate(veset, encKey);
    db.prepare(`
      UPDATE veset_dates
      SET date = ?, type = ?, onah = ?, heb_year = ?, heb_month = ?, heb_day = ?, enc_heb = ?
      WHERE id = ?
    `).run(
      encrypted.date,
      encrypted.type,
      encrypted.onah,
      encrypted.heb_year,
      encrypted.heb_month,
      encrypted.heb_day,
      encrypted.enc_heb,
      veset.id
    );
    vestotsEncrypted++;
  }

  return { cyclesEncrypted, vestotsEncrypted };
}

module.exports = { migrateUserRecords };
