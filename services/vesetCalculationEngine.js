/**
 * VesetCalculationEngine
 *
 * Core calculation module for computing veset (anticipated period) dates
 * based on cycle history and the user's halachic settings.
 *
 * Supports veset types:
 *  - onah_beinonit: onset + 29 days (day 30), same onah
 *  - onah_beinonit_31: onset + 30 days (day 31), same onah (if setting enabled)
 *  - haflagah: interval-based recurrence (1st haflagah)
 *  - haflagah_2: previous interval (2nd haflagah, conditional)
 *  - haflagah_3: interval from 2 records back (3rd haflagah, if setting enabled)
 *  - hachodesh: same Hebrew calendar day next month
 *  - Or Zarua variants: opposite onah for each of the above (if setting enabled)
 */

const HebrewDateUtils = require('./hebrewDateUtils');

class VesetCalculationEngine {

  /**
   * Recalculate all vestot for a user from scratch.
   * Clears existing veset_dates and recomputes from full cycle history.
   *
   * @param {number} userId - User ID
   * @param {Object} settings - { posek, onah_beinonit_31, or_zarua, haflagah_shlishit, hachodesh_overflow }
   * @param {Object} cycleRepository - Repository for cycle records
   * @param {Object} vesetRepository - Repository for veset dates
   * @returns {Array} All computed veset objects
   */
  recalculateAll(userId, settings, cycleRepository, vesetRepository) {
    // Handle legacy calls where settings is just a posek string
    if (typeof settings === 'string') {
      settings = {
        posek: settings,
        onah_beinonit_31: 1,
        or_zarua: 1,
        haflagah_shlishit: 1,
        hachodesh_overflow: 0
      };
    }

    // 1. Delete all existing veset_dates for this user
    vesetRepository.deleteByUser(userId);

    // 2. Get all cycle_records sorted by start_rd ascending
    const records = cycleRepository.findByUser(userId);

    // 3. Compute all intervals (with +1 for halachic counting)
    const intervals = this._computeIntervals(records);

    // 4. For each record, calculate all applicable vestot
    const allVestot = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordVestot = this._calculateForRecord(record, records, i, intervals, settings);
      allVestot.push(...recordVestot);
    }

    // 5. Save all calculated vestot
    if (allVestot.length > 0) {
      vesetRepository.saveAll(userId, allVestot);
    }

    return allVestot;
  }

  /**
   * Calculate all vestot for a single record.
   * @private
   */
  _calculateForRecord(record, allRecords, index, intervals, settings) {
    const vestot = [];
    const posek = settings.posek;

    // === Onah Beinonit (day 30 = onset + 29) ===
    const beinonit = this._calcOnahBeinonit(record);
    vestot.push(beinonit);

    // === Onah Beinonit 31 (day 31 = onset + 30) ===
    if (settings.onah_beinonit_31) {
      const beinonit31 = this._calcOnahBeinonit31(record);
      vestot.push(beinonit31);
    }

    // === Veset Haflagah (1st) ===
    if (index >= 1) {
      const haflagah1 = this._calcHaflagah1(record, allRecords, index, intervals, posek);
      if (haflagah1) vestot.push(haflagah1);
    }

    // === Veset Haflagah (2nd) ===
    if (index >= 2) {
      const haflagah2 = this._calcHaflagah2(record, allRecords, index, intervals, posek);
      if (haflagah2) vestot.push(haflagah2);
    }

    // === Veset Haflagah (3rd) - only if haflagah_shlishit setting ===
    if (settings.haflagah_shlishit && index >= 3) {
      const haflagah3 = this._calcHaflagah3(record, allRecords, index, intervals, posek);
      if (haflagah3) vestot.push(haflagah3);
    }

    // === Veset Hachodesh ===
    const hachodesh = this._calcHachodesh(record, allRecords, index, posek, settings.hachodesh_overflow);
    if (hachodesh) vestot.push(hachodesh);

    // === Or Zarua: add opposite onah for each entry ===
    if (settings.or_zarua) {
      const orZaruaEntries = [];
      for (const v of vestot) {
        const oz = this._makeOrZarua(v);
        if (oz) orZaruaEntries.push(oz);
      }
      vestot.push(...orZaruaEntries);
    }

    return vestot;
  }

  // ========== Onah Beinonit ==========

  /**
   * Onset + 29 days (day 30), same onah.
   */
  _calcOnahBeinonit(record) {
    const targetRd = record.start_rd + 29;
    const targetHeb = HebrewDateUtils.rd2heb(targetRd);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'onah_beinonit',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: targetHeb.year,
      heb_month: targetHeb.month,
      heb_day: targetHeb.day,
      onah: record.onah,
      is_or_zarua: 0
    };
  }

  /**
   * Onset + 30 days (day 31), same onah.
   */
  _calcOnahBeinonit31(record) {
    const targetRd = record.start_rd + 30;
    const targetHeb = HebrewDateUtils.rd2heb(targetRd);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'onah_beinonit_31',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: targetHeb.year,
      heb_month: targetHeb.month,
      heb_day: targetHeb.day,
      onah: record.onah,
      is_or_zarua: 0
    };
  }

  // ========== Haflagah ==========

  /**
   * 1st Haflagah: Use last interval, add to current onset.
   * Interval includes both endpoints (rd_diff + 1).
   * Onah = onah of the CURRENT record.
   */
  _calcHaflagah1(record, allRecords, index, intervals, posek) {
    // intervals[i-1] is the interval between records[i-1] and records[i]
    const intervalsUpToCurrent = intervals.slice(0, index);
    if (intervalsUpToCurrent.length === 0) return null;

    if (posek === 'mechaber') {
      if (!this._hasThreeConsecutiveIdentical(intervalsUpToCurrent)) return null;
    }

    const lastInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 1];
    const targetRd = record.start_rd + lastInterval;
    const targetHeb = HebrewDateUtils.rd2heb(targetRd);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'haflagah',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: targetHeb.year,
      heb_month: targetHeb.month,
      heb_day: targetHeb.day,
      onah: record.onah,
      is_or_zarua: 0
    };
  }

  /**
   * 2nd Haflagah: Conditional on current interval <= previous interval.
   * Uses the PREVIOUS interval value.
   * Onah = onah of the PREVIOUS record (not current!).
   */
  _calcHaflagah2(record, allRecords, index, intervals, posek) {
    // Need at least 2 intervals (index >= 2 means intervals[0..index-1] has at least 2)
    const intervalsUpToCurrent = intervals.slice(0, index);
    if (intervalsUpToCurrent.length < 2) return null;

    // Mechaber doesn't use haflagah_2 concept (only veset kavua with 3 identical)
    if (posek === 'mechaber') return null;

    const currentInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 1];
    const previousInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 2];

    // Condition: current haflagah interval <= previous haflagah interval
    if (currentInterval > previousInterval) return null;

    const targetRd = record.start_rd + previousInterval;
    const targetHeb = HebrewDateUtils.rd2heb(targetRd);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    // Onah of the PREVIOUS record
    const previousRecord = allRecords[index - 1];

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'haflagah_2',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: targetHeb.year,
      heb_month: targetHeb.month,
      heb_day: targetHeb.day,
      onah: previousRecord.onah,
      is_or_zarua: 0
    };
  }

  /**
   * 3rd Haflagah: Uses interval from 2 records back.
   * Condition: interval[-2] > interval[-1] AND interval[-2] > interval[0] (current).
   * Onah = onah of current record (same as haflagah_1).
   */
  _calcHaflagah3(record, allRecords, index, intervals, posek) {
    const intervalsUpToCurrent = intervals.slice(0, index);
    if (intervalsUpToCurrent.length < 3) return null;

    // Mechaber doesn't use this
    if (posek === 'mechaber') return null;

    const currentInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 1];
    const prevInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 2];
    const prevPrevInterval = intervalsUpToCurrent[intervalsUpToCurrent.length - 3];

    // Condition: the interval from 2 back is larger than both the last and current
    if (!(prevPrevInterval > prevInterval && prevPrevInterval > currentInterval)) return null;

    const targetRd = record.start_rd + prevPrevInterval;
    const targetHeb = HebrewDateUtils.rd2heb(targetRd);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'haflagah_3',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: targetHeb.year,
      heb_month: targetHeb.month,
      heb_day: targetHeb.day,
      onah: record.onah,
      is_or_zarua: 0
    };
  }

  // ========== Hachodesh ==========

  /**
   * Veset Hachodesh: same Hebrew day next month.
   * Uses hachodesh_overflow setting for day overflow behavior.
   */
  _calcHachodesh(record, allRecords, index, posek, hachodeshOverflow) {
    if (posek === 'mechaber') {
      if (!this._hasThreeConsecutiveSameDay(allRecords.slice(0, index + 1))) return null;
    }

    const currentHeb = {
      year: record.start_heb_year,
      month: record.start_heb_month,
      day: record.start_heb_day
    };

    const overflowToNext = !!hachodeshOverflow;
    const nextMonthHeb = HebrewDateUtils.addMonths(currentHeb, 1, overflowToNext);
    if (!nextMonthHeb) return null; // Day doesn't exist and overflow is false

    const targetRd = HebrewDateUtils.heb2rd(nextMonthHeb);
    const targetGreg = HebrewDateUtils.rd2greg(targetRd);

    return {
      user_id: record.user_id,
      source_record_id: record.id,
      type: 'hachodesh',
      date: this._toISODate(targetGreg),
      date_rd: targetRd,
      heb_year: nextMonthHeb.year,
      heb_month: nextMonthHeb.month,
      heb_day: nextMonthHeb.day,
      onah: record.onah,
      is_or_zarua: 0
    };
  }

  // ========== Or Zarua ==========

  /**
   * Create an Or Zarua entry for a given veset entry.
   * If original onah = "day" → same date, onah = "night"
   * If original onah = "night" → date - 1 day (previous RD), onah = "day"
   */
  _makeOrZarua(veset) {
    if (veset.onah === 'day') {
      // Same date, opposite onah (night)
      return {
        ...veset,
        onah: 'night',
        is_or_zarua: 1
      };
    } else {
      // Night → previous day, onah = day
      const targetRd = veset.date_rd - 1;
      const targetHeb = HebrewDateUtils.rd2heb(targetRd);
      const targetGreg = HebrewDateUtils.rd2greg(targetRd);
      return {
        user_id: veset.user_id,
        source_record_id: veset.source_record_id,
        type: veset.type,
        date: this._toISODate(targetGreg),
        date_rd: targetRd,
        heb_year: targetHeb.year,
        heb_month: targetHeb.month,
        heb_day: targetHeb.day,
        onah: 'day',
        is_or_zarua: 1
      };
    }
  }

  // ========== Helper Methods ==========

  /**
   * Compute intervals (in days) between consecutive records.
   * Halachic counting: interval = rd_diff + 1 (includes the start day).
   *
   * @param {Array} records - Cycle records sorted by start_rd ascending
   * @returns {Array<number>} Array of intervals in days
   */
  _computeIntervals(records) {
    const intervals = [];
    for (let i = 1; i < records.length; i++) {
      intervals.push(records[i].start_rd - records[i - 1].start_rd + 1);
    }
    return intervals;
  }

  /**
   * Check if the last 3 intervals are all identical (for Mechaber haflagah).
   */
  _hasThreeConsecutiveIdentical(intervals) {
    if (intervals.length < 3) return false;
    const last3 = intervals.slice(-3);
    return last3[0] === last3[1] && last3[1] === last3[2];
  }

  /**
   * Check if the last 3 records all started on the same Hebrew day of month
   * (for Mechaber hachodesh).
   */
  _hasThreeConsecutiveSameDay(records) {
    if (records.length < 3) return false;
    const last3 = records.slice(-3);
    const days = last3.map(r => r.start_heb_day);
    return days[0] === days[1] && days[1] === days[2];
  }

  /**
   * Convert a Date object to ISO date string (YYYY-MM-DD).
   */
  _toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = new VesetCalculationEngine();
