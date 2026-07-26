const session = require('express-session');
const SQLiteStore = require('better-sqlite3-session-store')(session);
const db = require('../db');

/**
 * Configured express-session middleware with SQLite-backed store.
 * Session secret is configurable via SESSION_SECRET environment variable.
 * Cookie maxAge is set to 7 days.
 */
const sessionMiddleware = session({
  store: new SQLiteStore({ client: db }),
  secret: process.env.SESSION_SECRET || 'default-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
});

module.exports = sessionMiddleware;
