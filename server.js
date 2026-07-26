'use strict';

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const sessionMiddleware = require('./middleware/session');

const app = express();

// Hide Express fingerprint
app.disable('x-powered-by');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Trust proxy (behind NPM reverse proxy)
app.set('trust proxy', 1);

// Rate limiting for auth endpoints (aggressive)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min
  message: { error: 'יותר מדי ניסיונות. נסה שוב בעוד 15 דקות.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API rate limiter (lenient)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Session middleware (SQLite-backed)
app.use(sessionMiddleware);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cycles', require('./routes/cycles'));
app.use('/api/vestot', require('./routes/vestot'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/mechitzot', require('./routes/mechitzot'));
app.use('/api/docs', require('./routes/api-docs'));

// Fallback: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Luach Vestot server running on port ${PORT}`);
});

module.exports = app;
