/**
 * @file Domain type definitions for Yemey Prisha (Luach Vestot)
 * @description JSDoc typedefs for core domain objects used throughout the application.
 */

/**
 * A date in the Hebrew/Jewish calendar system.
 * @typedef {Object} HebrewDate
 * @property {number} year - Hebrew year (e.g. 5784)
 * @property {number} month - Hebrew month (1-13, where 13 is Adar II in leap years)
 * @property {number} day - Day of Hebrew month (1-30)
 */

/**
 * A halachic time unit representing either daytime or nighttime.
 * Day is from sunrise to sunset, night is from sunset to sunrise.
 * @typedef {'day' | 'night'} Onah
 */

/**
 * The halachic authority whose rulings the user follows.
 * - 'rama' (Ashkenazi): veset calculated from a single occurrence
 * - 'mechaber' (Sephardic): veset calculated only after three consecutive occurrences
 * @typedef {'rama' | 'mechaber'} Posek
 */

/**
 * A recorded period event with start date, Hebrew date components, and optional end date.
 * @typedef {Object} CycleRecord
 * @property {number} id - Unique record identifier
 * @property {number} userId - ID of the owning user
 * @property {string} startDate - ISO 8601 Gregorian start date (YYYY-MM-DD)
 * @property {number} startRd - Rata Die number for the start date
 * @property {HebrewDate} startHeb - Hebrew date representation of start date
 * @property {Onah} onah - Whether the period started during day or night
 * @property {string|null} endDate - ISO 8601 Gregorian end date, or null if not recorded
 */

/**
 * A calculated anticipated period date (yom prisha).
 * @typedef {Object} VesetDate
 * @property {number} id - Unique veset date identifier
 * @property {number} userId - ID of the owning user
 * @property {number} sourceRecordId - ID of the cycle record that generated this veset
 * @property {'haflagah' | 'hachodesh' | 'onah_beinonit'} type - The veset calculation type
 * @property {string} date - ISO 8601 Gregorian date (YYYY-MM-DD)
 * @property {number} dateRd - Rata Die number for the veset date
 * @property {HebrewDate} hebrewDate - Hebrew date representation
 * @property {Onah} onah - The onah for this separation day
 */

module.exports = {};
