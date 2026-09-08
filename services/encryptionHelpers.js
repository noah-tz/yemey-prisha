'use strict';

const cryptoService = require('./crypto');

/**
 * Encrypt cycle record fields before storage.
 * If encKey is null, returns record unchanged (plaintext fallback for legacy).
 * @param {Object} record - { start_date, start_heb_year, start_heb_month, start_heb_day, onah, ... }
 * @param {Buffer|null} encKey
 * @returns {Object} record with sensitive fields encrypted
 */
function encryptCycleRecord(record, encKey) {
  if (!encKey) return record;
  return {
    ...record,
    start_date: cryptoService.encrypt(record.start_date, encKey),
    start_rd: 0, // Zero out — real value in enc_heb
    onah: cryptoService.encrypt(record.onah, encKey),
    enc_heb: cryptoService.encryptJSON(
      { y: record.start_heb_year, m: record.start_heb_month, d: record.start_heb_day, rd: record.start_rd },
      encKey
    ),
    // Keep plaintext heb fields as 0 (they'll be read from enc_heb on decrypt)
    start_heb_year: 0,
    start_heb_month: 0,
    start_heb_day: 0
  };
}

/**
 * Decrypt cycle record fields after retrieval.
 * If encKey is null, returns record unchanged.
 * @param {Object} record
 * @param {Buffer|null} encKey
 * @returns {Object} record with sensitive fields decrypted
 */
function decryptCycleRecord(record, encKey) {
  if (!encKey || !record) return record;

  // Check if this record is actually encrypted (contains ':' separator from our format)
  if (!record.start_date || !record.start_date.includes(':')) {
    // Plaintext record (not yet encrypted / legacy)
    return record;
  }

  try {
    const decrypted = {
      ...record,
      start_date: cryptoService.decrypt(record.start_date, encKey),
      onah: cryptoService.decrypt(record.onah, encKey)
    };
    // Decrypt Hebrew date bundle (includes rd)
    if (record.enc_heb) {
      const heb = cryptoService.decryptJSON(record.enc_heb, encKey);
      decrypted.start_heb_year = heb.y;
      decrypted.start_heb_month = heb.m;
      decrypted.start_heb_day = heb.d;
      if (heb.rd) decrypted.start_rd = heb.rd; // restore real RD
    }
    return decrypted;
  } catch (e) {
    // Decryption failed — return as-is (possibly wrong key or corrupted)
    return record;
  }
}

/**
 * Encrypt veset date fields before storage.
 * @param {Object} veset - { date, type, onah, heb_year, heb_month, heb_day, ... }
 * @param {Buffer|null} encKey
 * @returns {Object}
 */
function encryptVesetDate(veset, encKey) {
  if (!encKey) return veset;
  return {
    ...veset,
    date: cryptoService.encrypt(veset.date, encKey),
    date_rd: 0, // Zero out — real value in enc_heb
    type: cryptoService.encrypt(veset.type, encKey),
    onah: cryptoService.encrypt(veset.onah, encKey),
    enc_heb: cryptoService.encryptJSON(
      { y: veset.heb_year, m: veset.heb_month, d: veset.heb_day, rd: veset.date_rd },
      encKey
    ),
    // Zero out plaintext heb fields
    heb_year: 0,
    heb_month: 0,
    heb_day: 0
  };
}

/**
 * Decrypt veset date fields after retrieval.
 * @param {Object} veset
 * @param {Buffer|null} encKey
 * @returns {Object}
 */
function decryptVesetDate(veset, encKey) {
  if (!encKey || !veset) return veset;

  // Check if this record is actually encrypted
  if (!veset.date || !veset.date.includes(':')) {
    return veset; // plaintext record
  }

  try {
    const decrypted = {
      ...veset,
      date: cryptoService.decrypt(veset.date, encKey),
      type: cryptoService.decrypt(veset.type, encKey),
      onah: cryptoService.decrypt(veset.onah, encKey)
    };
    if (veset.enc_heb) {
      const heb = cryptoService.decryptJSON(veset.enc_heb, encKey);
      decrypted.heb_year = heb.y;
      decrypted.heb_month = heb.m;
      decrypted.heb_day = heb.d;
      if (heb.rd) decrypted.date_rd = heb.rd;
    }
    return decrypted;
  } catch (e) {
    return veset;
  }
}

module.exports = {
  encryptCycleRecord,
  decryptCycleRecord,
  encryptVesetDate,
  decryptVesetDate
};
