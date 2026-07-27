'use strict';

const { loadUserData, saveUserData } = require('./userDataService');
const userRepository = require('../repositories/userRepository');
const vesetCalculationEngine = require('./vesetCalculationEngine');
const HebrewDateUtils = require('./hebrewDateUtils');

function createRecord(userId, input, encKey) {
  if (!encKey) throw new Error('Encryption key required');

  let startDate, startRd, startHeb;
  if (input.inputFormat === 'hebrew') {
    startHeb = input.startDateHeb;
    startRd = HebrewDateUtils.heb2rd(startHeb);
    startDate = toISODate(HebrewDateUtils.rd2greg(startRd));
  } else {
    startDate = input.startDate;
    startRd = HebrewDateUtils.greg2rd(new Date(startDate));
    startHeb = HebrewDateUtils.rd2heb(startRd);
  }

  const data = loadUserData(userId, encKey);

  // Check overlap
  if (data.cycles.some(c => c.start_rd === startRd)) {
    throw new Error('Date conflicts with existing cycle record');
  }

  const record = {
    id: data.next_cycle_id++,
    start_date: startDate,
    start_rd: startRd,
    start_heb_year: startHeb.year,
    start_heb_month: startHeb.month,
    start_heb_day: startHeb.day,
    onah: input.onah,
    end_date: input.endDate || null,
    created_at: new Date().toISOString()
  };

  data.cycles.push(record);
  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);

  return enrichWithInterval(record, data.cycles);
}

function updateRecord(userId, recordId, updates, encKey) {
  if (!encKey) throw new Error('Encryption key required');

  const data = loadUserData(userId, encKey);
  const idx = data.cycles.findIndex(c => c.id === recordId);
  if (idx === -1) throw new Error('Record not found');

  const existing = data.cycles[idx];

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
      existing.start_date = startDate;
      existing.start_rd = startRd;
      existing.start_heb_year = startHeb.year;
      existing.start_heb_month = startHeb.month;
      existing.start_heb_day = startHeb.day;
    }
  }
  if (updates.onah) existing.onah = updates.onah;
  if (updates.hasOwnProperty('endDate')) existing.end_date = updates.endDate;

  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);

  return enrichWithInterval(existing, data.cycles);
}

function deleteRecord(userId, recordId, encKey) {
  if (!encKey) throw new Error('Encryption key required');

  const data = loadUserData(userId, encKey);
  const idx = data.cycles.findIndex(c => c.id === recordId);
  if (idx === -1) throw new Error('Record not found');

  data.cycles.splice(idx, 1);
  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);

  return { deleted: true };
}

function getHistory(userId, encKey) {
  if (!encKey) return [];

  const data = loadUserData(userId, encKey);
  const sorted = [...data.cycles].sort((a, b) => a.start_rd - b.start_rd);
  return sorted.map((record, index) => {
    const interval = index > 0 ? record.start_rd - sorted[index - 1].start_rd + 1 : null;
    return { ...record, intervalFromPrevious: interval };
  });
}

function getVestot(userId, encKey) {
  if (!encKey) return [];
  const data = loadUserData(userId, encKey);
  return data.vestot || [];
}

function getVestotByDateRange(userId, encKey, fromRd, toRd) {
  const vestot = getVestot(userId, encKey);
  return vestot.filter(v => v.date_rd >= fromRd && v.date_rd <= toRd);
}

function importRecords(userId, records, encKey) {
  if (!encKey) throw new Error('Encryption key required');

  const data = loadUserData(userId, encKey);
  const results = { imported: 0, skipped: 0, errors: [] };

  const sorted = [...records].sort((a, b) => {
    let rdA, rdB;
    if (a.inputFormat === 'hebrew' && a.startDateHeb) rdA = HebrewDateUtils.heb2rd(a.startDateHeb);
    else rdA = a.startDate ? HebrewDateUtils.greg2rd(new Date(a.startDate)) : 0;
    if (b.inputFormat === 'hebrew' && b.startDateHeb) rdB = HebrewDateUtils.heb2rd(b.startDateHeb);
    else rdB = b.startDate ? HebrewDateUtils.greg2rd(new Date(b.startDate)) : 0;
    return rdA - rdB;
  });

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    try {
      if (!rec.onah || (rec.onah !== 'day' && rec.onah !== 'night')) {
        results.errors.push({ index: i, date: rec.startDate || '?', error: 'Invalid onah' });
        results.skipped++; continue;
      }

      let startDate, startRd, startHeb;
      if (rec.inputFormat === 'hebrew' && rec.startDateHeb) {
        startHeb = rec.startDateHeb;
        startRd = HebrewDateUtils.heb2rd(startHeb);
        startDate = toISODate(HebrewDateUtils.rd2greg(startRd));
      } else if (rec.startDate) {
        startDate = rec.startDate;
        startRd = HebrewDateUtils.greg2rd(new Date(startDate));
        startHeb = HebrewDateUtils.rd2heb(startRd);
      } else {
        results.errors.push({ index: i, date: '?', error: 'Missing date' });
        results.skipped++; continue;
      }

      if (data.cycles.some(c => c.start_rd === startRd)) {
        results.errors.push({ index: i, date: startDate, error: 'Date conflicts' });
        results.skipped++; continue;
      }

      data.cycles.push({
        id: data.next_cycle_id++,
        start_date: startDate, start_rd: startRd,
        start_heb_year: startHeb.year, start_heb_month: startHeb.month, start_heb_day: startHeb.day,
        onah: rec.onah, end_date: rec.endDate || null,
        created_at: new Date().toISOString()
      });
      results.imported++;
    } catch (err) {
      results.errors.push({ index: i, date: rec.startDate || '?', error: err.message });
      results.skipped++;
    }
  }

  if (results.imported > 0) {
    recalculateVestotInMemory(data, userId);
    saveUserData(userId, data, encKey);
  }

  return results;
}

// Mechitzot
function getMechitzot(userId, encKey) {
  if (!encKey) return [];
  const data = loadUserData(userId, encKey);
  return data.mechitzot || [];
}

function addMechitza(userId, afterRecordId, description, encKey) {
  if (!encKey) throw new Error('Encryption key required');
  const data = loadUserData(userId, encKey);
  const mechitza = { id: Date.now(), after_record_id: afterRecordId, description: description || null };
  data.mechitzot.push(mechitza);
  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);
  return mechitza;
}

function removeMechitza(userId, mechitzaId, encKey) {
  if (!encKey) throw new Error('Encryption key required');
  const data = loadUserData(userId, encKey);
  data.mechitzot = (data.mechitzot || []).filter(m => m.id !== mechitzaId);
  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);
}

// Internal: recalculate vestot from cycles in-memory
function recalculateVestotInMemory(data, userId) {
  const user = userRepository.findById(userId);
  const settings = {
    posek: user.posek,
    onah_beinonit_31: user.onah_beinonit_31,
    or_zarua: user.or_zarua,
    haflagah_shlishit: user.haflagah_shlishit,
    hachodesh_overflow: user.hachodesh_overflow
  };

  const sortedCycles = [...data.cycles].sort((a, b) => a.start_rd - b.start_rd);
  const mechitzaAfterIds = (data.mechitzot || []).map(m => m.after_record_id);

  // Use the calculation engine's pure function
  const allVestot = vesetCalculationEngine.calculateFromRecords(sortedCycles, settings, userId, mechitzaAfterIds);

  // Assign IDs
  let nextId = data.next_veset_id || 1;
  allVestot.forEach(v => { v.id = nextId++; });
  data.next_veset_id = nextId;
  data.vestot = allVestot;
}

function recalculateVestot(userId, encKey) {
  if (!encKey) return;
  const data = loadUserData(userId, encKey);
  recalculateVestotInMemory(data, userId);
  saveUserData(userId, data, encKey);
}

// Helpers
function toISODate(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function enrichWithInterval(record, cycles) {
  const sorted = [...cycles].sort((a, b) => a.start_rd - b.start_rd);
  const idx = sorted.findIndex(r => r.id === record.id);
  const interval = idx > 0 ? sorted[idx].start_rd - sorted[idx - 1].start_rd + 1 : null;
  return { ...record, intervalFromPrevious: interval };
}

module.exports = { createRecord, updateRecord, deleteRecord, getHistory, getVestot, getVestotByDateRange, importRecords, getMechitzot, addMechitza, removeMechitza, recalculateVestot };
