'use strict';

/**
 * Calculate sunset and sunrise times for a given date and location.
 * Uses the NOAA Solar Calculator algorithm (accurate to ~1 minute).
 * @param {Date} date
 * @param {number} lat - latitude in degrees
 * @param {number} lng - longitude in degrees
 * @returns {{ sunset: string, sunrise: string }} times in HH:MM format (local Israel time)
 */
function getSunTimes(date, lat, lng) {
  if (!lat || !lng) { lat = 31.7683; lng = 35.2137; } // Default: Jerusalem

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Julian Day Number
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const JDN = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const JD = JDN - 0.5; // Julian Date at midnight UT

  // Julian century
  const n = JD - 2451545.0; // days since J2000.0
  const T = n / 36525;

  // Solar coordinates
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360; // Mean longitude
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360; // Mean anomaly
  const Mrad = M * Math.PI / 180;

  // Equation of center
  const C = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
          + 0.00029 * Math.sin(3 * Mrad);

  // Sun's true longitude
  const sunLon = (L0 + C) % 360;

  // Obliquity of the ecliptic
  const obliquity = 23.439291 - 0.0130042 * T;
  const oblRad = obliquity * Math.PI / 180;

  // Sun's declination
  const sinDec = Math.sin(oblRad) * Math.sin(sunLon * Math.PI / 180);
  const dec = Math.asin(sinDec); // radians

  // Equation of time (minutes)
  const tanHalfObl = Math.tan(oblRad / 2);
  const y2 = tanHalfObl * tanHalfObl;
  const L0rad = L0 * Math.PI / 180;
  const ecc = 0.016708634 - 0.000042037 * T;
  const EoT = 4 * (180 / Math.PI) * (
    y2 * Math.sin(2 * L0rad)
    - 2 * ecc * Math.sin(Mrad)
    + 4 * ecc * y2 * Math.sin(Mrad) * Math.cos(2 * L0rad)
    - 0.5 * y2 * y2 * Math.sin(4 * L0rad)
    - 1.25 * ecc * ecc * Math.sin(2 * Mrad)
  );

  // Hour angle for sunset/sunrise (official zenith = 90.833°)
  const zenith = 90.833 * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const cosHA = (Math.cos(zenith) - Math.sin(latRad) * sinDec) / (Math.cos(latRad) * Math.cos(dec));

  if (cosHA > 1 || cosHA < -1) return { sunset: '--:--', sunrise: '--:--' };

  const HA = Math.acos(cosHA) * 180 / Math.PI; // in degrees

  // Solar noon (in minutes from midnight UTC)
  const solarNoon = 720 - 4 * lng - EoT; // minutes

  // Sunrise and sunset in UTC minutes
  const sunriseUTC = solarNoon - HA * 4;
  const sunsetUTC = solarNoon + HA * 4;

  // Convert to Israel local time
  const isDST = isIsraelDST(date);
  const offsetMinutes = isDST ? 180 : 120; // UTC+3 or UTC+2

  const sunrise = formatMinutes(sunriseUTC + offsetMinutes);
  const sunset = formatMinutes(sunsetUTC + offsetMinutes);

  return { sunset, sunrise };
}

function isIsraelDST(date) {
  // Israel DST rules (approximate): last Friday in March to last Sunday in October
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  if (month > 2 && month < 9) return true; // Apr(3) through Sep(8) always DST
  if (month < 2 || month > 9) return false; // Jan, Feb, Nov, Dec never DST

  if (month === 2) { // March
    // Last Friday of March
    const lastDay = new Date(year, 3, 0).getDate();
    const lastFri = lastDay - ((new Date(year, 2, lastDay).getDay() + 2) % 7);
    return date.getDate() >= lastFri;
  }

  if (month === 9) { // October
    // Last Sunday of October
    const lastDay = new Date(year, 10, 0).getDate();
    const lastSun = lastDay - (new Date(year, 9, lastDay).getDay());
    return date.getDate() < lastSun;
  }

  return false;
}

function formatMinutes(totalMinutes) {
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m >= 60 ? 0 : m).padStart(2, '0');
}

module.exports = { getSunTimes };
