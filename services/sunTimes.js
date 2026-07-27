'use strict';

/**
 * Calculate sunset and sunrise times for a given date and location.
 * Uses a simplified solar position algorithm (accurate to ~2 minutes).
 * @param {Date} date
 * @param {number} lat - latitude in degrees
 * @param {number} lng - longitude in degrees
 * @returns {{ sunset: string, sunrise: string }} times in HH:MM format (Israel local time)
 */
function getSunTimes(date, lat, lng) {
  // Default to Jerusalem if no location
  if (!lat || !lng) { lat = 31.7683; lng = 35.2137; }

  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const zenith = 90.833; // Official sunset zenith (includes refraction)

  // Sunrise/sunset calculation (simplified NOAA algorithm)
  const lngHour = lng / 15;

  // Sunset
  const t_set = dayOfYear + ((18 - lngHour) / 24);
  const M_set = (0.9856 * t_set) - 3.289;
  let L_set = M_set + (1.916 * Math.sin(M_set * Math.PI / 180)) + (0.020 * Math.sin(2 * M_set * Math.PI / 180)) + 282.634;
  L_set = ((L_set % 360) + 360) % 360;
  let RA_set = Math.atan(0.91764 * Math.tan(L_set * Math.PI / 180)) * 180 / Math.PI;
  RA_set = ((RA_set % 360) + 360) % 360;
  const Lquadrant_set = Math.floor(L_set / 90) * 90;
  const RAquadrant_set = Math.floor(RA_set / 90) * 90;
  RA_set += (Lquadrant_set - RAquadrant_set);
  RA_set /= 15;
  const sinDec_set = 0.39782 * Math.sin(L_set * Math.PI / 180);
  const cosDec_set = Math.cos(Math.asin(sinDec_set));
  const cosH_set = (Math.cos(zenith * Math.PI / 180) - (sinDec_set * Math.sin(lat * Math.PI / 180))) / (cosDec_set * Math.cos(lat * Math.PI / 180));

  if (cosH_set > 1 || cosH_set < -1) return { sunset: '--:--', sunrise: '--:--' }; // No sunset/sunrise

  const H_set = Math.acos(cosH_set) * 180 / Math.PI / 15;
  let UT_set = H_set + RA_set - (0.06571 * t_set) - 6.622;
  UT_set = ((UT_set % 24) + 24) % 24;

  // Sunrise
  const t_rise = dayOfYear + ((6 - lngHour) / 24);
  const M_rise = (0.9856 * t_rise) - 3.289;
  let L_rise = M_rise + (1.916 * Math.sin(M_rise * Math.PI / 180)) + (0.020 * Math.sin(2 * M_rise * Math.PI / 180)) + 282.634;
  L_rise = ((L_rise % 360) + 360) % 360;
  let RA_rise = Math.atan(0.91764 * Math.tan(L_rise * Math.PI / 180)) * 180 / Math.PI;
  RA_rise = ((RA_rise % 360) + 360) % 360;
  const Lquadrant_rise = Math.floor(L_rise / 90) * 90;
  const RAquadrant_rise = Math.floor(RA_rise / 90) * 90;
  RA_rise += (Lquadrant_rise - RAquadrant_rise);
  RA_rise /= 15;
  const sinDec_rise = 0.39782 * Math.sin(L_rise * Math.PI / 180);
  const cosDec_rise = Math.cos(Math.asin(sinDec_rise));
  const cosH_rise = (Math.cos(zenith * Math.PI / 180) - (sinDec_rise * Math.sin(lat * Math.PI / 180))) / (cosDec_rise * Math.cos(lat * Math.PI / 180));
  const H_rise = (360 - Math.acos(cosH_rise) * 180 / Math.PI) / 15;
  let UT_rise = H_rise + RA_rise - (0.06571 * t_rise) - 6.622;
  UT_rise = ((UT_rise % 24) + 24) % 24;

  // Convert UT to Israel time (UTC+2 or UTC+3 for DST)
  const isDST = isIsraelDST(date);
  const offset = isDST ? 3 : 2;

  const sunset = formatTime(UT_set + offset);
  const sunrise = formatTime(UT_rise + offset);

  return { sunset, sunrise };
}

function isIsraelDST(date) {
  // Israel DST: last Friday before April 2 → last Sunday before October 31
  const month = date.getMonth();
  if (month > 2 && month < 9) return true; // Apr-Sep always DST
  if (month === 2) return date.getDate() >= 23; // Approximate late March
  if (month === 9) return date.getDate() <= 27; // Approximate late October
  return false;
}

function formatTime(hours) {
  hours = ((hours % 24) + 24) % 24;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m === 60 ? 0 : m).padStart(2, '0');
}

module.exports = { getSunTimes };
