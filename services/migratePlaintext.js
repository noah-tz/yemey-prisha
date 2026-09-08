'use strict';

const db = require('../db');
const { encryptCycleRecord, decryptCycleRecord, encryptVesetDate, decryptVesetDate } = require('./encryptionHelpers');
const cryptoService = require('./crypto');
const cycleRepository = require('../repositories/cycleRepository');
const vesetRepository = require('../repositories/vesetRepository');

/**
 * Migrate existing plaintext records for a user to encrypted form.
 * Should be called once after user first logs in with the new encryption system.
 * Safe to call multiple times — only encrypts records that aren't already encrypted.
 * Also handles re-encrypting enc_heb to include rd values for already-encrypted records.
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
    if (record.start_date && record.start_date.includes(':')) {
      // Already encrypted — but check if start_rd still has a real value (needs rd migration)
      if (record.start_rd !== 0) {
        // Re-encrypt enc_heb to include rd, then zero out start_rd column
        const heb = record.enc_heb ? cryptoService.decryptJSON(record.enc_heb, encKey) : {};
        heb.rd = record.start_rd;
        const newEncHeb = cryptoService.encryptJSON(heb, encKey);
        db.prepare(`
          UPDATE cycle_records SET enc_heb = ?, start_rd = 0 WHERE id = ?
        `).run(newEncHeb, record.id);
        cyclesEncrypted++;
      }
      continue;
    }

    const encrypted = encryptCycleRecord(record, encKey);
    // Update with encrypted values — also zero out start_rd
    db.prepare(`
      UPDATE cycle_records
      SET start_date = ?, onah = ?, start_heb_year = 0, start_heb_month = 0, start_heb_day = 0, enc_heb = ?, start_rd = 0
      WHERE id = ?
    `).run(
      encrypted.start_date,
      encrypted.onah,
      encrypted.enc_heb,
      record.id
    );
    cyclesEncrypted++;
  }

  // Encrypt plaintext veset dates
  const vestot = vesetRepository.findByUser(userId);
  for (const veset of vestot) {
    if (veset.date && veset.date.includes(':')) {
      // Already encrypted — but check if date_rd still has a real value
      if (veset.date_rd !== 0) {
        const heb = veset.enc_heb ? cryptoService.decryptJSON(veset.enc_heb, encKey) : {};
        heb.rd = veset.date_rd;
        const newEncHeb = cryptoService.encryptJSON(heb, encKey);
        db.prepare(`
          UPDATE veset_dates SET enc_heb = ?, date_rd = 0 WHERE id = ?
        `).run(newEncHeb, veset.id);
        vestotsEncrypted++;
      }
      continue;
    }

    const encrypted = encryptVesetDate(veset, encKey);
    db.prepare(`
      UPDATE veset_dates
      SET date = ?, type = ?, onah = ?, heb_year = 0, heb_month = 0, heb_day = 0, enc_heb = ?, date_rd = 0
      WHERE id = ?
    `).run(
      encrypted.date,
      encrypted.type,
      encrypted.onah,
      encrypted.enc_heb,
      veset.id
    );
    vestotsEncrypted++;
  }

  return { cyclesEncrypted, vestotsEncrypted };
}

module.exports = { migrateUserRecords };
