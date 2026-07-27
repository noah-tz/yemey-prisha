'use strict';

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { migrateUserRecords } = require('../services/migratePlaintext');
const requireAuth = require('../middleware/auth');

/**
 * POST /register
 * Create a new user account.
 */
router.post('/register', async (req, res) => {
  // Block registration if ALLOW_REGISTRATION is set to 'false' or '0'
  const allowReg = process.env.ALLOW_REGISTRATION;
  if (allowReg === 'false' || allowReg === '0') {
    return res.status(403).json({ error: 'הרשמה סגורה כעת' });
  }

  try {
    const { email, password, termsAccepted } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({ error: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' });
    }

    const user = await authService.register(email, password);

    // Log consent
    const db = require('../db');
    db.prepare(
      'INSERT INTO consent_log (user_id, terms_version, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(user.id, '1.0', req.ip || req.connection.remoteAddress, req.headers['user-agent'] || '');
    db.prepare('UPDATE users SET terms_accepted = ? WHERE id = ?').run('1.0', user.id);

    req.session.userId = user.id;
    req.session.encKey = user.encKey; // hex string of encryption key
    return res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    if (err.message === 'Email already registered') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err.message === 'Password must be at least 8 characters') {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /login
 * Authenticate user and create session.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.login(email, password);
    req.session.userId = user.id;
    req.session.encKey = user.encKey; // hex string of encryption key
    return res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /logout
 * Destroy session (clears encKey from memory).
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  });
});

/**
 * POST /migrate-encryption
 * Encrypt existing plaintext records for the current user.
 * Requires authentication and an active encryption key.
 */
router.post('/migrate-encryption', requireAuth, (req, res) => {
  try {
    if (!req.encKey) {
      return res.status(400).json({ error: 'Encryption key not available. Please log out and log in again.' });
    }
    const result = migrateUserRecords(req.userId, req.encKey);
    return res.json({
      message: 'Migration complete',
      cyclesEncrypted: result.cyclesEncrypted,
      vestotsEncrypted: result.vestotsEncrypted
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /forgot-password
 * Send a password reset email.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = require('../db');
    const crypto = require('crypto');
    const user = db.prepare('SELECT id, enc_key_encrypted FROM users WHERE email = ?').get(email);
    
    // Always return success (don't reveal if email exists)
    if (!user) return res.json({ message: 'אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(token, expires, user.id);

    const { sendReminder } = require('../services/emailService');
    const isE2E = !user.enc_key_encrypted;
    const resetUrl = `https://veset.dina-ins.co.il/reset-password.html?token=${token}`;
    
    let warningHtml = '';
    if (isE2E) {
      warningHtml = '<div style="background:#FFF3E0; padding:1rem; border-radius:8px; margin:1rem 0; border-right:4px solid #FF9800;"><strong>שים לב:</strong> הנתונים שלך מוצפנים עם הסיסמה הנוכחית. איפוס הסיסמה <strong>ימחק את כל הנתונים</strong> (ראיות, ימי פרישה). לא ניתן לשחזר.</div>';
    }

    const html = `
      <div dir="rtl" style="font-family:Arial,'Noto Sans Hebrew',sans-serif; max-width:500px; margin:0 auto; padding:20px;">
        <h2 style="color:#1976D2; text-align:center;">איפוס סיסמה</h2>
        <p>התקבלה בקשה לאיפוס הסיסמה שלך בלוח וסתות.</p>
        ${warningHtml}
        <p style="text-align:center; margin:30px 0;">
          <a href="${resetUrl}" style="background:#1976D2; color:white; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:16px;">איפוס סיסמה</a>
        </p>
        <p style="color:#666; font-size:13px;">הקישור תקף לשעה אחת.</p>
        <p style="font-size:11px; color:#bbb;">אם לא ביקשת — התעלם מהודעה זו.</p>
      </div>
    `;

    await sendReminder(email, 'איפוס סיסמה — לוח וסתות', html);
    return res.json({ message: 'אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /reset-password
 * Reset password with token.
 */
router.post('/reset-password', (req, res) => {
  try {
    const { token, password, confirmDataLoss } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = require('../db');
    const bcrypt = require('bcrypt');
    const cryptoService = require('../services/crypto');
    const { loadUserData, saveUserData } = require('../services/userDataService');

    const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
    if (!user) return res.status(400).json({ error: 'קישור לא תקין או פג תוקף' });
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'קישור פג תוקף' });
    }

    const isE2E = !user.enc_key_encrypted;

    // Hash new password
    const hash = bcrypt.hashSync(password, 12);
    
    // Generate new encryption key
    const encSalt = cryptoService.generateSalt();
    const newEncKey = cryptoService.deriveKey(password, encSalt);

    if (isE2E) {
      // E2E mode: data is lost — delete blob and start fresh
      if (!confirmDataLoss) {
        return res.status(400).json({ error: 'יש לאשר מחיקת נתונים', requireConfirm: true });
      }
      db.prepare('DELETE FROM user_data WHERE user_id = ?').run(user.id);
      db.prepare('UPDATE users SET password_hash = ?, enc_salt = ?, enc_key_encrypted = NULL, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
        .run(hash, encSalt, user.id);
    } else {
      // Extended mode: re-encrypt blob with new key
      const oldEncKey = cryptoService.unwrapKeyFromStorage(user.enc_key_encrypted);
      const data = loadUserData(user.id, oldEncKey);
      
      // Save with new key
      saveUserData(user.id, data, newEncKey);
      
      // Update user with new password hash, new salt, new wrapped key
      const newEncKeyEncrypted = cryptoService.wrapKeyForStorage(newEncKey);
      db.prepare('UPDATE users SET password_hash = ?, enc_salt = ?, enc_key_encrypted = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
        .run(hash, encSalt, newEncKeyEncrypted, user.id);
    }

    return res.json({ message: 'הסיסמה אופסה בהצלחה' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
