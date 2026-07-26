const cycleRepository = require('../repositories/cycleRepository');
const vesetRepository = require('../repositories/vesetRepository');
const userRepository = require('../repositories/userRepository');
const vesetCalculationEngine = require('./vesetCalculationEngine');
const HebrewDateUtils = require('./hebrewDateUtils');

/**
 * Create a new cycle record.
 * @param {number} userId
 * @param {Object} input - { startDate?, startDateHeb?, onah, endDate?, inputFormat }
 *   inputFormat: 'gregorian' or 'hebrew'
 *   startDate: ISO string (when inputFormat='gregorian')
 *   startDateHeb: { year, month, day } (when inputFormat='hebrew')
 * @returns {Object} created record
 */
function createRecord(userId, input) {
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

  // 2. Check for overlapping records
  const overlapping = cycleRepository.findOverlapping(userId, startRd, null);
  if (overlapping.length > 0) {
    throw new Error('Date conflicts with existing cycle record');
  }

  // 3. Create the record
  const record = cycleRepository.create(userId, {
    start_date: startDate,
    start_rd: startRd,
    start_heb_year: startHeb.year,
    start_heb_month: startHeb.month,
    start_heb_day: startHeb.day,
    onah: input.onah,
    end_date: input.endDate || null
  });

  // 4. Trigger veset recalculation
  const user = userRepository.findById(userId);
  const settings = {
    posek: user.posek,
    onah_beinonit_31: user.onah_beinonit_31,
    or_zarua: user.or_zarua,
    haflagah_shlishit: user.haflagah_shlishit,
    hachodesh_overflow: user.hachodesh_overflow
  };
  vesetCalculationEngine.recalculateAll(userId, settings, cycleRepository, vesetRepository);

  // 5. Return the record with interval from previous
  return enrichWithInterval(record, userId);
}

/**
 * Update an existing cycle record.
 * @param {number} userId
 * @param {number} recordId
 * @param {Object} updates - { startDate?, startDateHeb?, onah?, endDate?, inputFormat? }
 * @returns {Object} updated record
 */
function updateRecord(userId, recordId, updates) {
  // Verify ownership
  const existing = cycleRepository.findById(userId, recordId);
  if (!existing) throw new Error('Record not found');

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

  const updated = cycleRepository.update(userId, recordId, updateData);

  // Trigger recalculation
  const user = userRepository.findById(userId);
  const settings = {
    posek: user.posek,
    onah_beinonit_31: user.onah_beinonit_31,
    or_zarua: user.or_zarua,
    haflagah_shlishit: user.haflagah_shlishit,
    hachodesh_overflow: user.hachodesh_overflow
  };
  vesetCalculationEngine.recalculateAll(userId, settings, cycleRepository, vesetRepository);

  return enrichWithInterval(updated, userId);
}

/**
 * Delete a cycle record.
 * @param {number} userId
 * @param {number} recordId
 * @returns {{ deleted: boolean }}
 */
function deleteRecord(userId, recordId) {
  const existing = cycleRepository.findById(userId, recordId);
  if (!existing) throw new Error('Record not found');

  cycleRepository.delete(userId, recordId);

  // Trigger recalculation
  const user = userRepository.findById(userId);
  const settings = {
    posek: user.posek,
    onah_beinonit_31: user.onah_beinonit_31,
    or_zarua: user.or_zarua,
    haflagah_shlishit: user.haflagah_shlishit,
    hachodesh_overflow: user.hachodesh_overflow
  };
  vesetCalculationEngine.recalculateAll(userId, settings, cycleRepository, vesetRepository);

  return { deleted: true };
}

/**
 * Get full cycle history for a user, sorted chronologically with interval info.
 * @param {number} userId
 * @returns {Array<Object>}
 */
function getHistory(userId) {
  const records = cycleRepository.findByUser(userId);
  // Add interval from previous record
  return records.map((record, index) => {
    const interval = index > 0 ? record.start_rd - records[index - 1].start_rd : null;
    return { ...record, intervalFromPrevious: interval };
  });
}

// Helper: convert Date to ISO date string (YYYY-MM-DD)
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: add interval info to a single record
function enrichWithInterval(record, userId) {
  const all = cycleRepository.findByUser(userId);
  const idx = all.findIndex(r => r.id === record.id);
  const interval = idx > 0 ? all[idx].start_rd - all[idx - 1].start_rd : null;
  return { ...record, intervalFromPrevious: interval };
}

/**
 * Bulk import multiple cycle records at once.
 * Records are sorted by date, validated, inserted, and vestot recalculated once at the end.
 * @param {number} userId
 * @param {Array<{startDate: string, onah: string, endDate?: string}>} records
 * @returns {{ imported: number, skipped: number, errors: Array<{index: number, date: string, error: string}> }}
 */
function importRecords(userId, records) {
  const results = { imported: 0, skipped: 0, errors: [] };

  // Sort records by date ascending (use startDate if available, otherwise convert hebrew first for sorting)
  const sorted = [...records].sort((a, b) => {
    const dateA = a.startDate || '';
    const dateB = b.startDate || '';
    if (dateA && dateB) return dateA.localeCompare(dateB);
    // If one or both use hebrew input, compute RD for comparison
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
      // Validate onah
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

      // Parse date - support both gregorian and hebrew
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

      // Check overlap
      const overlapping = cycleRepository.findOverlapping(userId, startRd, null);
      if (overlapping.length > 0) {
        results.errors.push({ index: i, date: startDate, error: 'Date conflicts with existing record' });
        results.skipped++;
        continue;
      }

      // Insert (without triggering recalculation per record)
      cycleRepository.create(userId, {
        start_date: startDate,
        start_rd: startRd,
        start_heb_year: startHeb.year,
        start_heb_month: startHeb.month,
        start_heb_day: startHeb.day,
        onah: rec.onah,
        end_date: rec.endDate || null
      });

      results.imported++;
    } catch (err) {
      results.errors.push({ index: i, date: rec.startDate || '?', error: err.message });
      results.skipped++;
    }
  }

  // Recalculate ONCE at the end (not per record)
  if (results.imported > 0) {
    const user = userRepository.findById(userId);
    const settings = {
      posek: user.posek,
      onah_beinonit_31: user.onah_beinonit_31,
      or_zarua: user.or_zarua,
      haflagah_shlishit: user.haflagah_shlishit,
      hachodesh_overflow: user.hachodesh_overflow
    };
    vesetCalculationEngine.recalculateAll(userId, settings, cycleRepository, vesetRepository);
  }

  return results;
}

module.exports = { createRecord, updateRecord, deleteRecord, getHistory, importRecords };
