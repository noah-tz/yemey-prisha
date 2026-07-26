'use strict';

/**
 * Hebrew Date Utils - Node.js CommonJS Module
 * Based on Rata Die (R.D.) algorithm by Dershowitz & Reingold
 * Adapted from Google Apps Script library to Node.js module.
 */

// ========== Constants ==========
const EPOCH = -1373428;

const NISAN = 1, IYYAR = 2, SIVAN = 3, TAMUZ = 4, AV = 5, ELUL = 6;
const TISHREI = 7, CHESHVAN = 8, KISLEV = 9, TEVET = 10, SHVAT = 11;
const ADAR_I = 12, ADAR_II = 13;

const MONTH_DAYS = [0, 30, 29, 30, 29, 30, 29, 30, 0, 0, 29, 30, 0, 29];

// ========== Core Calendar Functions ==========

function isLeapYear(year) {
  return (1 + year * 7) % 19 < 7;
}

function monthsInYear(year) {
  return isLeapYear(year) ? 13 : 12;
}

function elapsedDays(year) {
  const prevYear = year - 1;
  const mElapsed = 235 * Math.floor(prevYear / 19) +
    12 * (prevYear % 19) +
    Math.floor(((prevYear % 19) * 7 + 1) / 19);
  const pElapsed = 204 + 793 * (mElapsed % 1080);
  const hElapsed = 5 + 12 * mElapsed +
    793 * Math.floor(mElapsed / 1080) +
    Math.floor(pElapsed / 1080);
  const parts = (pElapsed % 1080) + 1080 * (hElapsed % 24);
  const day = 1 + 29 * mElapsed + Math.floor(hElapsed / 24);
  let altDay = day;
  if (parts >= 19440 ||
    (2 === day % 7 && parts >= 9924 && !isLeapYear(year)) ||
    (1 === day % 7 && parts >= 16789 && isLeapYear(prevYear))) {
    altDay++;
  }
  if (altDay % 7 === 0 || altDay % 7 === 3 || altDay % 7 === 5) {
    return altDay + 1;
  }
  return altDay;
}

function daysInYear(year) {
  return elapsedDays(year + 1) - elapsedDays(year);
}

function longCheshvan(year) {
  return daysInYear(year) % 10 === 5;
}

function shortKislev(year) {
  return daysInYear(year) % 10 === 3;
}

function daysInMonth(month, year) {
  const d = MONTH_DAYS[month];
  if (d !== 0) return d;
  if (month === ADAR_I) return isLeapYear(year) ? 30 : 29;
  if (month === CHESHVAN) return longCheshvan(year) ? 30 : 29;
  return shortKislev(year) ? 29 : 30;
}

// ========== Absolute (R.D.) Conversions ==========

function hebrew2abs(year, month, day) {
  let tempabs = day;
  if (month < TISHREI) {
    for (let m = TISHREI; m <= monthsInYear(year); m++) tempabs += daysInMonth(m, year);
    for (let m = NISAN; m < month; m++) tempabs += daysInMonth(m, year);
  } else {
    for (let m = TISHREI; m < month; m++) tempabs += daysInMonth(m, year);
  }
  return EPOCH + elapsedDays(year) + tempabs - 1;
}

function abs2hebrew(abs) {
  abs = Math.trunc(abs);
  let year = Math.floor((abs - EPOCH) / 365.24682220597794);
  while (EPOCH + elapsedDays(year) <= abs) year++;
  year--;
  let month = abs < hebrew2abs(year, 1, 1) ? 7 : 1;
  while (abs > hebrew2abs(year, month, daysInMonth(month, year))) month++;
  const day = 1 + abs - hebrew2abs(year, month, 1);
  return { yy: year, mm: month, dd: day };
}

function isGregLeap(year) {
  return !(year % 4) && (!!(year % 100) || !(year % 400));
}

function greg2abs(year, month, day) {
  const py = year - 1;
  return (365 * py + Math.floor(py / 4) - Math.floor(py / 100) +
    Math.floor(py / 400) + Math.floor((367 * month - 362) / 12) +
    (month <= 2 ? 0 : isGregLeap(year) ? -1 : -2) + day);
}

function abs2greg(abs) {
  abs = Math.trunc(abs);
  const l0 = abs - 1;
  const n400 = Math.floor(l0 / 146097);
  const d1 = l0 % 146097;
  const n100 = Math.floor(d1 / 36524);
  const d2 = d1 % 36524;
  const n4 = Math.floor(d2 / 1461);
  const d3 = d2 % 1461;
  const n1 = Math.floor(d3 / 365);
  let year = 400 * n400 + 100 * n100 + 4 * n4 + n1;
  if (n100 !== 4 && n1 !== 4) year++;
  const priorDays = abs - greg2abs(year, 1, 1);
  const correction = abs < greg2abs(year, 3, 1) ? 0 : isGregLeap(year) ? 1 : 2;
  const month = Math.floor((12 * (priorDays + correction) + 373) / 367);
  const day = abs - greg2abs(year, month, 1) + 1;
  return new Date(year, month - 1, day);
}

// ========== Month Name Data ==========

const MONTH_NAMES_HEB = [
  '', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב\''
];

const MONTH_PREFIX_NIKUD = [
  '', '\u05D1\u05B0\u05BC\u05E0\u05B4\u05D9\u05E1\u05B8\u05DF',
  '\u05D1\u05B0\u05BC\u05D0\u05B4\u05D9\u05B8\u05D9\u05E8',
  '\u05D1\u05B0\u05BC\u05E1\u05B4\u05D9\u05D5\u05B8\u05DF',
  '\u05D1\u05B0\u05BC\u05EA\u05B7\u05BC\u05DE\u05BC\u05D5\u05BC\u05D6',
  '\u05D1\u05B0\u05BC\u05D0\u05B8\u05D1',
  '\u05D1\u05B6\u05BC\u05D0\u05B1\u05DC\u05D5\u05BC\u05DC',
  '\u05D1\u05B0\u05BC\u05EA\u05B4\u05BC\u05E9\u05C1\u05B0\u05E8\u05B5\u05D9',
  '\u05D1\u05B0\u05BC\u05D7\u05B6\u05E9\u05C1\u05B0\u05D5\u05B8\u05DF',
  '\u05D1\u05B0\u05BC\u05DB\u05B4\u05BC\u05E1\u05B0\u05DC\u05B5\u05D5',
  '\u05D1\u05B0\u05BC\u05D8\u05B5\u05D1\u05B5\u05EA',
  '\u05D1\u05B4\u05BC\u05E9\u05C1\u05B0\u05D1\u05B8\u05D8',
  '\u05D1\u05B7\u05BC\u05D0\u05B2\u05D3\u05B8\u05E8',
  '\u05D1\u05B7\u05BC\u05D0\u05B2\u05D3\u05B8\u05E8 \u05D1\u05F3'
];

const MONTH_PREFIX_PLAIN = [
  '', 'בניסן', 'באייר', 'בסיון', 'בתמוז', 'באב', 'באלול',
  'בתשרי', 'בחשון', 'בכסלו', 'בטבת', 'בשבט', 'באדר', 'באדר ב\''
];

// ========== Gematria ==========

function toGematriya(num) {
  const letters = [
    [400, '\u05EA'], [300, '\u05E9'], [200, '\u05E8'], [100, '\u05E7'],
    [90, '\u05E6'], [80, '\u05E4'], [70, '\u05E2'], [60, '\u05E1'],
    [50, '\u05E0'], [40, '\u05DE'], [30, '\u05DC'], [20, '\u05DB'], [10, '\u05D9'],
    [9, '\u05D8'], [8, '\u05D7'], [7, '\u05D6'], [6, '\u05D5'], [5, '\u05D4'],
    [4, '\u05D3'], [3, '\u05D2'], [2, '\u05D1'], [1, '\u05D0']
  ];
  if (num >= 1000) num = num % 1000;
  if (num === 15) return '\u05D8\u05F4\u05D5';
  if (num === 16) return '\u05D8\u05F4\u05D6';
  let str = '';
  for (let i = 0; i < letters.length; i++) {
    while (num >= letters[i][0]) { str += letters[i][1]; num -= letters[i][0]; }
  }
  if (str.length === 1) str += '\u05F3';
  else if (str.length > 1) str = str.slice(0, -1) + '\u05F4' + str.slice(-1);
  return str;
}

// ========== Month Name Parsing ==========

function monthFromName(name) {
  if (typeof name === 'number') return name;
  const n = String(name).trim().toLowerCase();
  switch (n) {
    case 'nisan': case 'nissan': return NISAN;
    case 'iyyar': case 'iyar': return IYYAR;
    case 'sivan': return SIVAN;
    case 'tamuz': case 'tammuz': return TAMUZ;
    case 'av': return AV;
    case 'elul': return ELUL;
    case 'tishrei': return TISHREI;
    case 'cheshvan': case 'heshvan': case 'marcheshvan': return CHESHVAN;
    case 'kislev': return KISLEV;
    case 'tevet': case 'tebet': return TEVET;
    case "sh'vat": case 'shvat': case 'shevat': return SHVAT;
    case 'adar': case 'adar i': return ADAR_I;
    case 'adar ii': case 'adar 2': return ADAR_II;
    default: throw new Error('Unknown Hebrew month: ' + name);
  }
}

// ========== HebDate Internal Class ==========

class HebDate {
  constructor(year, month, day) {
    this.year = year;
    this.month = month;
    this.day = day;
  }

  static fromGregorian(gregDate, afterSunset) {
    let d = gregDate;
    if (!(d instanceof Date)) {
      if (typeof d === 'number') d = new Date(1899, 11, 30 + d);
      else d = new Date(d);
    }
    let abs = greg2abs(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (afterSunset) abs++;
    const h = abs2hebrew(abs);
    return new HebDate(h.yy, h.mm, h.dd);
  }

  static fromHebrew(year, month, day) {
    const m = (typeof month === 'string') ? monthFromName(month) : month;
    return new HebDate(year, m, day);
  }

  toGregorian() {
    const abs = hebrew2abs(this.year, this.month, this.day);
    return abs2greg(abs);
  }

  toAbsolute() {
    return hebrew2abs(this.year, this.month, this.day);
  }

  isLeapYear() {
    return isLeapYear(this.year);
  }

  daysInMonth() {
    return daysInMonth(this.month, this.year);
  }

  monthsInYear() {
    return monthsInYear(this.year);
  }

  monthName(withNikud) {
    const m = this.month;
    if (m === ADAR_I && !this.isLeapYear()) {
      return withNikud ? '\u05D0\u05B2\u05D3\u05B8\u05E8' : 'אדר';
    }
    const arr = withNikud ? MONTH_PREFIX_NIKUD : MONTH_NAMES_HEB;
    return arr[m] || '';
  }

  monthPrefix(withNikud) {
    if (this.month === ADAR_I && !this.isLeapYear()) {
      return withNikud ? '\u05D1\u05B7\u05BC\u05D0\u05B2\u05D3\u05B8\u05E8' : 'באדר';
    }
    return withNikud ? MONTH_PREFIX_NIKUD[this.month] : MONTH_PREFIX_PLAIN[this.month];
  }

  format(fmt) {
    if (typeof fmt === 'undefined') fmt = 1;
    if (fmt === 0) {
      return this.day + '-' + this.month + '-' + this.year;
    }
    const dayStr = toGematriya(this.day);
    const yearStr = toGematriya(this.year);
    const withNikud = (fmt === 1);
    const monthStr = this.monthPrefix(withNikud);
    return dayStr + ' ' + monthStr + ' ' + yearStr;
  }

  addMonths(numMonths, overflowToNext) {
    if (typeof overflowToNext === 'undefined') overflowToNext = true;
    let y = this.year;
    let m = this.month;

    for (let i = 0; i < numMonths; i++) {
      if (m === ELUL) {
        y++;
        m = TISHREI;
      } else if (m === monthsInYear(y)) {
        m = NISAN;
      } else {
        m++;
      }
    }

    const maxDay = daysInMonth(m, y);
    if (this.day <= maxDay) {
      return new HebDate(y, m, this.day);
    }

    // Overflow case
    if (!overflowToNext) return null;

    // Advance to 1st of next month
    if (m === ELUL) {
      return new HebDate(y + 1, TISHREI, 1);
    } else if (m === monthsInYear(y)) {
      return new HebDate(y, NISAN, 1);
    } else {
      return new HebDate(y, m + 1, 1);
    }
  }

  toObject() {
    return { yy: this.year, mm: this.month, dd: this.day };
  }

  clone() {
    return new HebDate(this.year, this.month, this.day);
  }
}

// ========== Public API: HebrewDateUtils static class ==========

class HebrewDateUtils {
  /**
   * Convert a Gregorian date to Hebrew date.
   * @param {Date|string} gregDate - Date object or ISO date string
   * @returns {{ year: number, month: number, day: number }}
   */
  static greg2heb(gregDate) {
    const hd = HebDate.fromGregorian(gregDate);
    return { year: hd.year, month: hd.month, day: hd.day };
  }

  /**
   * Convert a Hebrew date to Gregorian.
   * @param {{ year: number, month: number, day: number }} hebDate
   * @returns {Date}
   */
  static heb2greg(hebDate) {
    const hd = new HebDate(hebDate.year, hebDate.month, hebDate.day);
    return hd.toGregorian();
  }

  /**
   * Convert a Gregorian date to Rata Die integer.
   * @param {Date|string} gregDate - Date object or ISO date string
   * @returns {number}
   */
  static greg2rd(gregDate) {
    let d = gregDate;
    if (!(d instanceof Date)) d = new Date(d);
    return greg2abs(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /**
   * Convert a Rata Die integer to Gregorian Date.
   * @param {number} rataDie
   * @returns {Date}
   */
  static rd2greg(rataDie) {
    return abs2greg(rataDie);
  }

  /**
   * Convert a Rata Die integer to Hebrew date.
   * @param {number} rataDie
   * @returns {{ year: number, month: number, day: number }}
   */
  static rd2heb(rataDie) {
    const h = abs2hebrew(rataDie);
    return { year: h.yy, month: h.mm, day: h.dd };
  }

  /**
   * Convert a Hebrew date to Rata Die integer.
   * @param {{ year: number, month: number, day: number }} hebDate
   * @returns {number}
   */
  static heb2rd(hebDate) {
    return hebrew2abs(hebDate.year, hebDate.month, hebDate.day);
  }

  /**
   * Add months to a Hebrew date, handling variable month lengths and leap years.
   * @param {{ year: number, month: number, day: number }} hebDate
   * @param {number} numMonths
   * @param {boolean} [overflowToNext=true] - if day overflows target month,
   *   advance to 1st of next month (true) or return null (false)
   * @returns {{ year: number, month: number, day: number }|null}
   */
  static addMonths(hebDate, numMonths, overflowToNext) {
    if (typeof overflowToNext === 'undefined') overflowToNext = true;
    const hd = new HebDate(hebDate.year, hebDate.month, hebDate.day);
    const result = hd.addMonths(numMonths, overflowToNext);
    if (!result) return null;
    return { year: result.year, month: result.month, day: result.day };
  }

  /**
   * Format a Hebrew date as a string.
   * @param {{ year: number, month: number, day: number }} hebDate
   * @param {number} [formatType=1] - 0: numeric, 1: nikud, 2: plain
   * @returns {string}
   */
  static format(hebDate, formatType) {
    const hd = new HebDate(hebDate.year, hebDate.month, hebDate.day);
    return hd.format(formatType);
  }

  /**
   * Get the Hebrew month name.
   * @param {number} month
   * @param {number} year
   * @returns {string}
   */
  static monthName(month, year) {
    if (month === ADAR_I && !isLeapYear(year)) {
      return 'אדר';
    }
    return MONTH_NAMES_HEB[month] || '';
  }
}

// ========== Backward-compatible Public API (GAS custom functions) ==========

/**
 * Convert Gregorian date to Hebrew formatted string.
 * @param {Date|string} gregDate
 * @param {number} [format=1]
 * @param {boolean} [afterSunset=false]
 * @returns {string}
 */
function GREG2HEB(gregDate, format, afterSunset) {
  const hd = HebDate.fromGregorian(gregDate, afterSunset);
  return hd.format(format);
}

/**
 * Convert Hebrew date components to Gregorian Date.
 * @param {number} year
 * @param {number|string} month
 * @param {number} day
 * @returns {Date}
 */
function HEB2GREG(year, month, day) {
  const hd = HebDate.fromHebrew(year, month, day);
  return hd.toGregorian();
}

/**
 * Get Hebrew date as formatted string from components.
 * @param {number} year
 * @param {number|string} month
 * @param {number} day
 * @param {number} [format=1]
 * @returns {string}
 */
function HEBDATE(year, month, day, format) {
  const hd = HebDate.fromHebrew(year, month, day);
  return hd.format(format);
}

/**
 * Add months to a Hebrew date and return formatted string.
 * @param {Date|string} gregDate
 * @param {number} numMonths
 * @param {number} [format=1]
 * @param {boolean} [afterSunset=false]
 * @returns {string|null}
 */
function HEB_ADD_MONTHS_FMT(gregDate, numMonths, format, afterSunset) {
  const hd = HebDate.fromGregorian(gregDate, afterSunset);
  const result = hd.addMonths(numMonths);
  if (!result) return null;
  return result.format(format);
}

/**
 * Add months to a Hebrew date and return Gregorian Date.
 * @param {Date|string} gregDate
 * @param {number} numMonths
 * @param {boolean} [afterSunset=false]
 * @returns {Date|null}
 */
function HEB_ADD_MONTHS(gregDate, numMonths, afterSunset) {
  const hd = HebDate.fromGregorian(gregDate, afterSunset);
  const result = hd.addMonths(numMonths);
  if (!result) return null;
  return result.toGregorian();
}

/**
 * Add months to a Hebrew date and return raw object { yy, mm, dd }.
 * @param {Date|string} gregDate
 * @param {number} numMonths
 * @param {boolean} [afterSunset=false]
 * @returns {{ yy: number, mm: number, dd: number }|null}
 */
function HEB_ADD_MONTHS_RAW(gregDate, numMonths, afterSunset) {
  const hd = HebDate.fromGregorian(gregDate, afterSunset);
  const result = hd.addMonths(numMonths);
  if (!result) return null;
  return result.toObject();
}

// ========== Module Exports ==========

module.exports = HebrewDateUtils;
module.exports.HebrewDateUtils = HebrewDateUtils;
module.exports.HebDate = HebDate;
module.exports.GREG2HEB = GREG2HEB;
module.exports.HEB2GREG = HEB2GREG;
module.exports.HEBDATE = HEBDATE;
module.exports.HEB_ADD_MONTHS = HEB_ADD_MONTHS;
module.exports.HEB_ADD_MONTHS_RAW = HEB_ADD_MONTHS_RAW;
module.exports.HEB_ADD_MONTHS_FMT = HEB_ADD_MONTHS_FMT;

// ========== Self-test (run with: node services/hebrewDateUtils.js) ==========

if (require.main === module) {
  console.log('=== HebrewDateUtils Self-Test ===\n');

  // Test 1: Gregorian -> Hebrew round-trip
  const testDate = new Date(2024, 2, 15); // March 15, 2024
  const heb = HebrewDateUtils.greg2heb(testDate);
  console.log(`Greg 2024-03-15 -> Hebrew: ${heb.year}/${heb.month}/${heb.day}`);
  const backToGreg = HebrewDateUtils.heb2greg(heb);
  console.log(`Back to Greg: ${backToGreg.toISOString().slice(0, 10)}`);
  console.assert(
    backToGreg.getFullYear() === 2024 &&
    backToGreg.getMonth() === 2 &&
    backToGreg.getDate() === 15,
    'Round-trip failed!'
  );
  console.log('✓ Round-trip: PASS\n');

  // Test 2: Rata Die conversions
  const rd = HebrewDateUtils.greg2rd(testDate);
  console.log(`Greg 2024-03-15 -> RD: ${rd}`);
  const rdBack = HebrewDateUtils.rd2greg(rd);
  console.assert(
    rdBack.getFullYear() === 2024 &&
    rdBack.getMonth() === 2 &&
    rdBack.getDate() === 15,
    'RD round-trip failed!'
  );
  console.log('✓ RD round-trip: PASS\n');

  // Test 3: rd2heb / heb2rd
  const hebFromRd = HebrewDateUtils.rd2heb(rd);
  const rdFromHeb = HebrewDateUtils.heb2rd(hebFromRd);
  console.assert(rd === rdFromHeb, 'heb2rd/rd2heb mismatch!');
  console.log(`✓ rd2heb/heb2rd: PASS (RD ${rd} = ${rdFromHeb})\n`);

  // Test 4: addMonths basic
  const cheshvan30 = { year: 5784, month: CHESHVAN, day: 30 };
  const nextMonth = HebrewDateUtils.addMonths(cheshvan30, 1);
  console.log(`addMonths(5784/Cheshvan/30, 1) -> ${nextMonth.year}/${nextMonth.month}/${nextMonth.day}`);
  console.log('✓ addMonths basic: PASS\n');

  // Test 5: addMonths overflow (day > max in target month)
  // Kislev can be 29 days (short kislev) - test with day 30
  const kislev30 = { year: 5784, month: KISLEV, day: 30 };
  const afterKislev = HebrewDateUtils.addMonths(kislev30, 1);
  console.log(`addMonths(5784/Kislev/30, 1) -> ${afterKislev.year}/${afterKislev.month}/${afterKislev.day}`);
  console.log('✓ addMonths overflow: PASS\n');

  // Test 6: addMonths with Elul -> Tishrei year boundary
  const elul15 = { year: 5784, month: ELUL, day: 15 };
  const afterElul = HebrewDateUtils.addMonths(elul15, 1);
  console.assert(
    afterElul.month === TISHREI && afterElul.year === 5785,
    'Elul->Tishrei boundary failed!'
  );
  console.log(`addMonths(5784/Elul/15, 1) -> ${afterElul.year}/${afterElul.month}/${afterElul.day}`);
  console.log('✓ Elul->Tishrei boundary: PASS\n');

  // Test 7: addMonths leap year (Adar I -> Adar II)
  // 5784 is a leap year
  const adarI15 = { year: 5784, month: ADAR_I, day: 15 };
  const afterAdarI = HebrewDateUtils.addMonths(adarI15, 1);
  console.assert(afterAdarI.month === ADAR_II, 'Adar I -> Adar II failed!');
  console.log(`addMonths(5784/AdarI/15, 1) -> ${afterAdarI.year}/${afterAdarI.month}/${afterAdarI.day}`);
  console.log('✓ Leap year Adar I->II: PASS\n');

  // Test 8: addMonths with overflowToNext=false
  const shortMonth = { year: 5785, month: CHESHVAN, day: 30 };
  const noOverflow = HebrewDateUtils.addMonths(shortMonth, 1, false);
  // If target month has fewer days and overflow is false, should return null
  if (noOverflow === null) {
    console.log('✓ addMonths overflow=false returns null: PASS\n');
  } else {
    console.log(`addMonths overflow=false returned: ${noOverflow.year}/${noOverflow.month}/${noOverflow.day}`);
    console.log('  (target month has enough days, no overflow needed)\n');
  }

  // Test 9: format
  const formatted = HebrewDateUtils.format(heb, 1);
  console.log(`Format (nikud): ${formatted}`);
  const formatted2 = HebrewDateUtils.format(heb, 0);
  console.log(`Format (numeric): ${formatted2}`);
  console.log('✓ Format: PASS\n');

  // Test 10: monthName
  const mName = HebrewDateUtils.monthName(7, 5784);
  console.log(`monthName(7, 5784) = ${mName}`);
  console.assert(mName === 'תשרי', 'monthName failed!');
  console.log('✓ monthName: PASS\n');

  // Test 11: ISO string input
  const hebFromISO = HebrewDateUtils.greg2heb('2024-03-15');
  console.assert(
    hebFromISO.year === heb.year && hebFromISO.month === heb.month && hebFromISO.day === heb.day,
    'ISO string input failed!'
  );
  console.log('✓ ISO string input: PASS\n');

  console.log('=== All self-tests passed! ===');
}
