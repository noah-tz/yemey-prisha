'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const reminderEmailRepo = require('../repositories/reminderEmailRepository');
const { sendReminder } = require('../services/emailService');

/**
 * GET /api/reminder-emails
 * List all reminder emails for this user (verified and pending).
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const emails = reminderEmailRepo.findAllByUser(req.userId);
    return res.json({ emails });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/reminder-emails
 * Add a new email and send verification.
 * Body: { email }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'כתובת מייל לא תקינה' });
    }

    const record = reminderEmailRepo.addEmail(req.userId, email);

    // Send verification email
    const verifyUrl = `https://veset.dina-ins.co.il/api/reminder-emails/verify/${record.verify_token}`;
    const html = `
      <div dir="rtl" style="font-family: Arial, 'Noto Sans Hebrew', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1976D2; text-align: center;">אימות כתובת מייל</h2>
        <p>שלום,</p>
        <p>נשלחה בקשה לשלוח אליך תזכורות ימי פרישה מלוח וסתות.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: #1976D2; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-size: 16px;">אשר כתובת מייל</a>
        </p>
        <p style="color: #666; font-size: 13px;">הקישור תקף ל-24 שעות.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">
          \u{1F4A1} <strong>טיפ:</strong> כדאי להעביר מייל זה לתיקיית "ראשי" (Primary) כדי שתזכורות עתידיות לא ייפלו לספאם.
        </p>
        <p style="font-size: 11px; color: #bbb; text-align: center;">
          אם לא ביקשת זאת — התעלם מהודעה זו.
        </p>
      </div>
    `;

    await sendReminder(email, 'אימות כתובת מייל — לוח וסתות', html);

    return res.status(200).json({ message: 'מייל אימות נשלח' });
  } catch (err) {
    if (err.message === 'כתובת זו כבר מאומתת') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reminder-emails/verify/:token
 * Verify an email address (clicked from email link).
 * Returns an HTML success page.
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const result = reminderEmailRepo.verifyToken(req.params.token);
    if (!result) {
      return res.send(`
        <html dir="rtl"><head><meta charset="utf-8"><title>שגיאה</title></head>
        <body style="font-family:Arial,sans-serif; text-align:center; padding:50px;">
          <h1 style="color: #D32F2F;">\u274C קישור לא תקין או פג תוקף</h1>
          <p>נא לבקש אימות מחדש מההגדרות.</p>
        </body></html>
      `);
    }
    return res.send(`
      <html dir="rtl"><head><meta charset="utf-8"><title>אומת!</title></head>
      <body style="font-family:Arial,sans-serif; text-align:center; padding:50px;">
        <h1 style="color: #388E3C;">\u2705 הכתובת אומתה בהצלחה!</h1>
        <p>תקבל/י תזכורות ימי פרישה לכתובת <strong>${result.email}</strong></p>
        <p style="margin-top:30px;"><a href="https://veset.dina-ins.co.il/#settings" style="color: #1976D2;">חזרה להגדרות</a></p>
      </body></html>
    `);
  } catch (err) {
    return res.status(500).send('Internal server error');
  }
});

/**
 * DELETE /api/reminder-emails/:id
 * Remove an email from the reminder list.
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    reminderEmailRepo.deleteEmail(req.userId, id);
    return res.json({ message: 'Email removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
