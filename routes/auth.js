const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

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
    const { email, password } = req.body;
    await authService.register(email, password);
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
 * Destroy session.
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
