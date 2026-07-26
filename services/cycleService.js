'use strict';

const cycleRepository = require('../repositories/cycleRepository');
const vesetRepository = require('../repositories/vesetRepository');
const userRepository = require('../repositories/userRepository');
const vesetCalculationEngine = require('./vesetCalculationEngine');
const HebrewDateUtils = require('./hebrewDateUtils');
const { encryptCycleRecord, decryptCycleRecord, encryptVesetDate } = require('./encryptionHelpers');

/**
 * Create a new cycle record.
 * @param {number} userId
 * @param {Object} input - { startDate?, startDateHeb?, onah, endDate?, inputFormat }
 * @param {Buffer|null} encKey - encryption key (null = plaintext mode)
 * @returns {Object} created record (decrypted)
 */
function createRecord(userId, input, encKey) {
  // 1. Parse and convert dates
  let startDate, startRd, startHeb;

  if (input.inputFormat === 'hebrew') {
    startHeb = input.startDateHeb; // { year, month, day }
    startRd = HebrewDateUtils.heb2rd(startHeb);
    const gregDate = HebrewDateUtils.rd2greg(startRd);
    startDate = toISODate(gregDate);
  } else {
    // Default: gregorian
    startDate = input.startDate;
    startRd = HebrewDateUtils.greg2rd(new Date(startDate));
    startHeb = HebrewDateUtils.rd2heb(startRd);
  }

  // 2. Check for overlapping records (by decrypting all and comparing rd)
  const allRecords = cycleRepository.findByUser(userId);
  const decryptedAll = allRecords.map(r => decryptCycleRecord(r, encKey));
  const overlap = decryptedAll.some(r => r.start_rd === startRd);
  if (overlap) {
    throw new Error('Date conflicts with existing cycle record');
  }

  // 3. Build the record data
  const recordData = {
    start_date: startDate,
    start_rd: startRd,
    start_heb_year: startHeb.year,
    start_heb_month: startHeb.month,
    start_heb_day: startHeb.day,
    onah: input.onah,
    end_date: input.endDate || null
  };

  // 4. Encrypt before storing
  const encryptedData = encryptCycleRecord(recordData, encKey);
  const record = cycleRepository.create(userId, encryptedData);

  // 5. Trigger veset recalculation (needs decrypted data)
  recalculateVestot(userId, encKey);

  // 6. Return the record decrypted with interval info
  const decryptedRecord = decryptCycleRecord(record, encKey);
  return enrichWithInterval(decryptedRecord, userId, encKey);
}

/**
 * Update an existing cycle record.
 * @param {number} userId
 * @param {number} recordId
 * @param {Object} updates - { startDate?, startDateHeb?, onah?, endDate?, inputFormat? }
 * @param {Buffer|null} encKey
 * @returns {Object} updated record (decrypted)
 */
function updateRecord(userId, recordId, updates, encKey) {
  // Verify ownership
  const existing = cycleRepository.findById(userId, recordId);
  if (!existing) throw new Error('Record not found');

  // Decrypt existing to work with plaintext
  const decryptedExisting = decryptCycleRecord(existing, encKey);

  // If date is being changed, recompute derived fields
  const updateData = {};

  if (updates.startDate || updates.startDateHeb) {
    let startDate, startRd, startHeb;
    if (updates.inputFormat === 'hebrew' && updates.startDateHeb) {
      startHeb = updates.startDateHeb;
      startRd = HebrewDateUtils.heb2rd(startHeb);
      startDate = toISODate(HebrewDateUtils.rd2greg(startRd));
    } else if (updates.startDate) {
      startDate = updates.startDate;
      startRd = HebrewDateUtils.greg2rd(new Date(startDate));
      startHeb = HebrewDateUtils.rd2heb(startRd);
    }
    if (startDate) {
      updateData.start_date = startDate;
      updateData.start_rd = startRd;
      updateData.start_heb_year = startHeb.year;
      updateData.start_heb_month = startHeb.month;
      updateData.start_heb_day = startHeb.day;
    }
  }

  if (updates.onah) updateData.onah = updates.onah;
  if (Object.prototype.hasOwnProperty.call(updates, 'endDate')) updateData.end_date = updates.endDate;

  // Encrypt the update data
  const encryptedUpdate = encryptCycleRecord(
    {
      start_date: updateData.start_date || decryptedExisting.start_date,
      start_heb_year: updateData.start_heb_year || decryptedExisting.start_heb_year,
      start_heb_month: updateData.start_heb_month || decryptedExisting.start_heb_month,
      start_heb_day: updateData.start_heb_day || decryptedExisting.start_heb_day,
      onah: updateData.onah || decryptedExisting.onah,
      start_rd: updateData.start_rd || decryptedExisting.start_rd,
      end_date: Object.prototype.hasOwnProperty.call(updateData, 'end_date') ? updateData.end_date : decryptedExisting.end_date
    },
    encKey
  );

  // Build final update payload for repository
  const repoUpdate = {};
  repoUpdate.start_rd = 0; // Always zero — real value is in enc_heb
  if (Object.prototype.hasOwnProperty.call(updateData, 'end_date')) repoUpdate.end_date = updateData.end_date;
  repoUpdate.start_date = encryptedUpdate.start_date;
  repoUpdate.start_heb_year = encryptedUpdate.start_heb_year;
  repoUpdate.start_heb_month = encryptedUpdate.start_heb_month;
  repoUpdate.start_heb_day = encryptedUpdate.start_heb_day;
  repoUpdate.onah = encryptedUpdate.onah;
  if (encryptedUpdate.enc_heb) repoUpdate.enc_heb = encryptedUpdate.enc_heb;

  const updated = cycleRepository.update(userId, recordId, repoUpdate);

  // Trigger recalculation
  recalculateVestot(userId, encKey);

  const decryptedUpdated = decryptCycleRecord(updated, encKey);
  return enrichWithInterval(decryptedUpdated, userId, encKey);
}

/**
 * Delete a cycle record.
 * @param {number} userId
 * @param {number} recordId
 * @param {Buffer|null} encKey
 * @returns {{ deleted: boolean }}
 */
function deleteRecord(userId, recordId, encKey) {
  const existing = cycleRepository.findById(userId, recordId);
  if (!existing) throw new Error('Record not found');

  cycleRepository.delete(userId, recordId);

  // Trigger recalculation
  recalculateVestot(userId, encKey);

  return { deleted: true };
}

/**
 * Get full cycle history for a user, sorted chronologically with interval info.
 * @param {number} userId
 * @param {Buffer|null} encKey
 * @returns {Array<Object>}
 */
function getHistory(userId, encKey) {
  const records = cycleRepository.findByUser(userId);
  // Decrypt all records
  const decrypted = records.map(r => decryptCycleRecord(r, encKey));
  // Sort by start_rd (now decrypted from enc_heb)
  decrypted.sort((a, b) => a.start_rd - b.start_rd);
  // Add interval from previous record
  return decrypted.map((record, index) => {
    const interval = index > 0 ? record.start_rd - decrypted[index - 1].start_rd : null;
    return { ...record, intervalFromPrevious: interval };
  });
}

/**
 * Bulk import multiple cycle records at once.
 * @param {number} userId
 * @param {Array} records
 * @param {Buffer|null} encKey
 * @returns {{ imported: number, skipped: number, errors: Array }}
 */
function importRecords(userId, records, encKey) {
  const results = { imported: 0, skipped: 0, errors: [] };

  // Sort records by date ascending
  const sorted = [...records].sort((a, b) => {
    const dateA = a.startDate || '';
    const dateB = b.startDate || '';
    if (dateA && dateB) return dateA.localeCompare(dateB);
    let rdA, rdB;
    if (a.inputFormat === 'hebrew' && a.startDateHeb) {
      rdA = HebrewDateUtils.heb2rd(a.startDateHeb);
    } else {
      rdA = a.startDate ? HebrewDateUtils.greg2rd(new Date(a.startDate)) : 0;
    }
    if (b.inputFormat === 'hebrew' && b.startDateHeb) {
      rdB = HebrewDateUtils.heb2rd(b.startDateHeb);
    } else {
      rdB = b.startDate ? HebrewDateUtils.greg2rd(new Date(b.startDate)) : 0;
    }
    return rdA - rdB;
  });

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    try {
      if (!rec.onah) {
        results.errors.push({ index: i, date: rec.startDate || '?', error: 'Missing onah' });
        results.skipped++;
        continue;
      }
      if (!rec.startDate && !rec.startDateHeb) {
        results.errors.push({ index: i, date: '?', error: 'Missing startDate or startDateHeb' });
        results.skipped++;
        continue;
      }
      if (rec.onah !== 'day' && rec.onah !== 'night') {
        results.errors.push({ index: i, date: rec.startDate || '?', error: "onah must be 'day' or 'night'" });
        results.skipped++;
        continue;
      }

      let startDate, startRd, startHeb;
      if (rec.inputFormat === 'hebrew' && rec.startDateHeb) {
        startHeb = rec.startDateHeb;
        startRd = HebrewDateUtils.heb2rd(startHeb);
        const gregDate = HebrewDateUtils.rd2greg(startRd);
        startDate = toISODate(gregDate);
      } else if (rec.startDate) {
        startDate = rec.startDate;
        startRd = HebrewDateUtils.greg2rd(new Date(startDate));
        startHeb = HebrewDateUtils.rd2heb(startRd);
      } else {
        results.errors.push({ index: i, date: '?', error: 'Missing startDate or startDateHeb' });
        results.skipped++;
        continue;
      }

      // Check overlap (decrypt all records and compare rd)
      const allExisting = cycleRepository.findByUser(userId);
      const decryptedExisting = allExisting.map(r => decryptCycleRecord(r, encKey));
      const hasOverlap = decryptedExisting.some(r => r.start_rd === startRd);
      if (hasOverlap) {
        results.errors.push({ index: i, date: startDate, error: 'Date conflicts with existing record' });
        results.skipped++;
        continue;
      }

      // Encrypt and insert
      const recordData = {
        start_date: startDate,
        start_rd: startRd,
        start_heb_year: startHeb.year,
        start_heb_month: startHeb.month,
        start_heb_day: startHeb.day,
        onah: rec.onah,
        end_date: rec.endDate || null
      };
      const encryptedData = encryptCycleRecord(recordData, encKey);
      cycleRepository.create(userId, encryptedData);

      results.imported++;
    } catch (err) {
      results.errors.push({ index: i, date: rec.startDate || '?', error: err.message });
      results.skipped++;
    }
  }

  // Recalculate ONCE at the end
  if (results.imported > 0) {
    recalculateVestot(userId, encKey);
  }

  return results;
}

/**
 * Recalculate all vestot for a user, handling encryption/decryption.
 * Reads encrypted cycle records → decrypts → calculates → encrypts results → stores.
 * @param {number} userId
 * @param {Buffer|null} encKey
 */
function recalculateVestot(userId, encKey) {
  const user = userRepository.findById(userId);
  const settings = {
    posek: user.posek,
    onah_beinonit_31: user.onah_beinonit_31,
    or_zarua: user.or_zarua,
    haflagah_shlishit: user.haflagah_shlishit,
    hachodesh_overflow: user.hachodesh_overflow
  };

  // Get all cycle records and decrypt them for calculation
  const encryptedRecords = cycleRepository.findByUser(userId);
  const decryptedRecords = encryptedRecords.map(r => decryptCycleRecord(r, encKey));

  // Delete existing vestot
  vesetRepository.deleteByUser(userId);

  // Calculate vestot using decrypted records
  // We need to pass decrypted records to the engine, so we use the engine's internal methods
  const allVestot = vesetCalculationEngine.calculateFromRecords(decryptedRecords, settings, userId);

  // Encrypt vestot before storing
  if (allVestot.length > 0) {
    const encryptedVestot = allVestot.map(v => encryptVesetDate(v, encKey));
    vesetRepository.saveAll(userId, encryptedVestot);
  }
}

// Helper: convert Date to ISO date string (YYYY-MM-DD)
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: add interval info to a single record
function enrichWithInterval(record, userId, encKey) {
  const all = cycleRepository.findByUser(userId);
  const decrypted = all.map(r => decryptCycleRecord(r, encKey));
  decrypted.sort((a, b) => a.start_rd - b.start_rd);
  const idx = decrypted.findIndex(r => r.id === record.id);
  const interval = idx > 0 ? decrypted[idx].start_rd - decrypted[idx - 1].start_rd : null;
  return { ...record, intervalFromPrevious: interval };
}

module.exports = { createRecord, updateRecord, deleteRecord, getHistory, importRecords, recalculateVestot };
