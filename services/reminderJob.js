'use strict';

const db = require('../db');
const cryptoService = require('./crypto');
const { decryptVesetDate } = require('./encryptionHelpers');
const vesetRepository = require('../repositories/vesetRepository');
const { sendReminder } = require('./emailService');
const HebrewDateUtils = require('./hebrewDateUtils');

/**
 * Run the daily reminder check.
 * For each user with reminders enabled:
 * 1. Unwrap their stored encryption key
 * 2. Find vestot for today (night) and tomorrow (day)
 * 3. Send a single email with all relevant prisha days
 */
async function runReminders() {
  console.log('[Reminder] Starting daily reminder check...');

  // Get all users with reminders enabled
  const users = db.prepare(
    'SELECT id, email, enc_key_encrypted, reminder_enabled, reminder_email FROM users WHERE reminder_enabled = 1'
  ).all();

  if (users.length === 0) {
    console.log('[Reminder] No users with reminders enabled.');
    return;
  }

  // Today and tomorrow Rata Die
  const now = new Date();
  const todayRd = HebrewDateUtils.greg2rd(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowRd = HebrewDateUtils.greg2rd(tomorrow);

  for (const user of users) {
    try {
      if (!user.enc_key_encrypted) {
        console.log(`[Reminder] User ${user.id} has no encryption key, skipping.`);
        continue;
      }

      // Decrypt the user's encryption key
      const encKey = cryptoService.unwrapKeyFromStorage(user.enc_key_encrypted);

      // Get ALL vestot for user and decrypt
      const allVestot = vesetRepository.findByUser(user.id);
      const decrypted = allVestot.map(v => decryptVesetDate(v, encKey));

      // Filter: tonight (today's date, onah=night) + tomorrow day (tomorrow's date, onah=day)
      const relevant = decrypted.filter(v => {
        if (v.date_rd === todayRd && v.onah === 'night') return true;
        if (v.date_rd === tomorrowRd && v.onah === 'day') return true;
        return false;
      });

      if (relevant.length === 0) {
        console.log(`[Reminder] User ${user.id}: no prisha days for tonight/tomorrow.`);
        continue;
      }

      // Build email
      const reminderEmailRepo = require('../repositories/reminderEmailRepository');
      const verifiedEmails = reminderEmailRepo.findVerifiedByUser(user.id);
      const recipients = verifiedEmails.map(e => e.email);

      // Also include the main reminder_email if set, or login email
      if (user.reminder_email) {
        if (!recipients.includes(user.reminder_email)) recipients.push(user.reminder_email);
      } else if (!recipients.includes(user.email)) {
        recipients.push(user.email);
      }

      if (recipients.length === 0) {
        console.log(`[Reminder] User ${user.id}: no verified emails, skipping.`);
        continue;
      }

      const subject = '\u{1F319} תזכורת ימי פרישה — ' + formatHebrewDate(relevant[0]);
      const body = buildReminderHtml(relevant, todayRd, tomorrowRd);

      // Send to all recipients
      for (const recipientEmail of recipients) {
        await sendReminder(recipientEmail, subject, body);
      }
      console.log(`[Reminder] Sent to ${recipients.length} recipients for user ${user.id}.`);

    } catch (err) {
      console.error(`[Reminder] Error for user ${user.id}:`, err.message);
    }
  }

  console.log('[Reminder] Done.');
}

function formatHebrewDate(veset) {
  if (!veset || !veset.heb_year) return '';
  const dayStr = toGematria(veset.heb_day);
  const months = ['', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול', 'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'];
  return dayStr + ' ' + (months[veset.heb_month] || '');
}

function toGematria(num) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל'];
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';
  if (num <= 9) return ones[num] + '\'';
  const t = Math.floor(num / 10);
  const o = num % 10;
  return (tens[t] || '') + (ones[o] || '') + '\'';
}

function buildReminderHtml(vestot, todayRd, tomorrowRd) {
  const typeLabels = {
    onah_beinonit: 'עונה בינונית',
    onah_beinonit_31: 'עונה בינונית (31)',
    haflagah: 'הפלגה 1',
    haflagah_2: 'הפלגה 2',
    haflagah_3: 'הפלגה 3',
    hachodesh: 'וסת החודש'
  };

  const tonight = vestot.filter(v => v.date_rd === todayRd && v.onah === 'night');
  const tomorrowDay = vestot.filter(v => v.date_rd === tomorrowRd && v.onah === 'day');

  let html = `
    <div dir="rtl" style="font-family: Arial, 'Noto Sans Hebrew', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1976D2; text-align: center;">\u{1F319} תזכורת ימי פרישה</h2>
  `;

  if (tonight.length > 0) {
    html += `<h3 style="color: #E91E63;">הלילה (עונת לילה):</h3><ul>`;
    tonight.forEach(v => {
      const label = (v.is_or_zarua ? 'א״ז ' : '') + (typeLabels[v.type] || v.type);
      html += `<li>${label}</li>`;
    });
    html += `</ul>`;
  }

  if (tomorrowDay.length > 0) {
    html += `<h3 style="color: #FF9800;">מחר (עונת יום):</h3><ul>`;
    tomorrowDay.forEach(v => {
      const label = (v.is_or_zarua ? 'א״ז ' : '') + (typeLabels[v.type] || v.type);
      html += `<li>${label}</li>`;
    });
    html += `</ul>`;
  }

  html += `
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        הודעה אוטומטית מלוח וסתות — veset.dina-ins.co.il
      </p>
    </div>
  `;

  return html;
}

// Allow running directly: node services/reminderJob.js
if (require.main === module) {
  runReminders().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runReminders };
