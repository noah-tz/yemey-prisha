/**
 * Hebrew date display helper
 * Formats Hebrew dates for display purposes.
 */
var HebrewDate = (function() {
  'use strict';

  var HEBREW_MONTHS = [
    'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
    'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'
  ];

  var ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  var TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  var HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

  /**
   * Convert a number to Hebrew gematria representation.
   * Works for numbers 1-999 (typical for day/year portions).
   */
  function toGematria(num) {
    if (num <= 0) return '';

    // Special cases for 15 and 16
    if (num === 15) return 'ט״ו';
    if (num === 16) return 'ט״ז';

    var result = '';
    var h = Math.floor(num / 100);
    var remainder = num % 100;
    var t = Math.floor(remainder / 10);
    var o = remainder % 10;

    // Handle hundreds (including 500+ which use combinations)
    while (h > 4) {
      result += HUNDREDS[4]; // ת
      h -= 4;
    }
    if (h > 0) {
      result += HUNDREDS[h];
    }

    result += TENS[t];
    result += ONES[o];

    // Add geresh for single character or gershayim before last character
    if (result.length === 1) {
      result += '׳';
    } else if (result.length > 1) {
      result = result.slice(0, -1) + '״' + result.slice(-1);
    }

    return result;
  }

  /**
   * Convert Hebrew year to display format.
   * Typically we show only last 3 digits with ה prefix (e.g. תשפ"ו)
   */
  function formatYear(year) {
    // Hebrew years in current millennium (5000+)
    var shortYear = year % 1000;
    return toGematria(shortYear);
  }

  /**
   * Get Hebrew month name by index.
   * Index follows the common convention: 1=Nisan ... 12=Adar, 13=Adar II
   */
  function getMonthName(month) {
    if (month >= 1 && month <= HEBREW_MONTHS.length) {
      return HEBREW_MONTHS[month - 1];
    }
    return '';
  }

  /**
   * Format a Hebrew date object as a readable Hebrew string.
   * @param {{ year: number, month: number, day: number }} hdate
   * @returns {string} e.g. "ו׳ בניסן תשפ״ו"
   */
  function format(hdate) {
    if (!hdate || !hdate.year || !hdate.month || !hdate.day) {
      return '';
    }
    var dayStr = toGematria(hdate.day);
    var monthName = getMonthName(hdate.month);
    var yearStr = formatYear(hdate.year);
    return dayStr + ' ב' + monthName + ' ' + yearStr;
  }

  /**
   * Short format - just day and month (no year)
   */
  function formatShort(hdate) {
    if (!hdate || !hdate.month || !hdate.day) {
      return '';
    }
    var dayStr = toGematria(hdate.day);
    var monthName = getMonthName(hdate.month);
    return dayStr + ' ' + monthName;
  }

  // ========== Calendar calculation helpers for day count ==========

  function isLeapYear(year) {
    return (1 + year * 7) % 19 < 7;
  }

  function elapsedDays(year) {
    var prevYear = year - 1;
    var mElapsed = 235 * Math.floor(prevYear / 19) +
      12 * (prevYear % 19) +
      Math.floor(((prevYear % 19) * 7 + 1) / 19);
    var pElapsed = 204 + 793 * (mElapsed % 1080);
    var hElapsed = 5 + 12 * mElapsed +
      793 * Math.floor(mElapsed / 1080) +
      Math.floor(pElapsed / 1080);
    var parts = (pElapsed % 1080) + 1080 * (hElapsed % 24);
    var day = 1 + 29 * mElapsed + Math.floor(hElapsed / 24);
    var altDay = day;
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

  /**
   * Get the number of days in a Hebrew month for a given year.
   * @param {number} month - Hebrew month (1-13)
   * @param {number} year - Hebrew year
   * @returns {number} days in month (29 or 30)
   */
  function daysInMonth(month, year) {
    // Fixed months
    switch (month) {
      case 1: return 30; // Nisan
      case 2: return 29; // Iyyar
      case 3: return 30; // Sivan
      case 4: return 29; // Tamuz
      case 5: return 30; // Av
      case 6: return 29; // Elul
      case 7: return 30; // Tishrei
      case 10: return 29; // Tevet
      case 11: return 30; // Shvat
      case 13: return 29; // Adar II
      // Variable months
      case 8: return longCheshvan(year) ? 30 : 29; // Cheshvan
      case 9: return shortKislev(year) ? 29 : 30;  // Kislev
      case 12: return isLeapYear(year) ? 30 : 29;  // Adar I
      default: return 30;
    }
  }

  return {
    format: format,
    formatShort: formatShort,
    toGematria: toGematria,
    getMonthName: getMonthName,
    formatYear: formatYear,
    daysInMonth: daysInMonth,
    isLeapYear: isLeapYear,
    HEBREW_MONTHS: HEBREW_MONTHS
  };
})();
