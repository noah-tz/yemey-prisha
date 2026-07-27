'use strict';

const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');
const cryptoService = require('./crypto');

const SALT_ROUNDS = 12;

/**
 * Register a new user with email and password.
 * Generates encryption salt, derives key, stores wrapped key.
 * @param {string} email
 * @param {string} password
 * @returns {{ id: number, email: string, posek: string, created_at: string, encKey: string }}
 * @throws {Error} If email is missing, password is too short, or email already exists
 */
function register(email, password) {
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('Email is required');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const hash = bcrypt.hashSync(password, SALT_ROUNDS);

  // Generate encryption salt and derive key
  const encSalt = cryptoService.generateSalt();
  const encKey = cryptoService.deriveKey(password, encSalt);
  // E2E mode by default: do NOT store enc_key_encrypted on registration
  // User must explicitly enable extended mode for API/reminders to work

  try {
    const user = userRepository.create(email, hash, encSalt, null);
    return { ...user, encKey: encKey.toString('hex') };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      throw new Error('Email already registered');
    }
    throw err;
  }
}

/**
 * Authenticate a user with email and password.
 * Derives encryption key from password + stored salt.
 * @param {string} email
 * @param {string} password
 * @returns {{ id: number, email: string, posek: string, created_at: string, encKey: string }}
 * @throws {Error} If credentials are invalid
 */
function login(email, password) {
  const user = userRepository.findByEmail(email);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const match = bcrypt.compareSync(password, user.password_hash);

  if (!match) {
    throw new Error('Invalid credentials');
  }

  // Derive encryption key
  let encKeyHex = null;
  if (user.enc_salt) {
    const encKey = cryptoService.deriveKey(password, user.enc_salt);
    encKeyHex = encKey.toString('hex');
    // Don't auto-store enc_key_encrypted on login anymore.
    // It's only stored when user explicitly enables extended mode.
  } else {
    // Legacy user without encryption — generate salt and key now
    const encSalt = cryptoService.generateSalt();
    const encKey = cryptoService.deriveKey(password, encSalt);
    // Only store enc_salt, not enc_key_encrypted (E2E by default)
    userRepository.updateEncryption(user.id, encSalt, null);
    encKeyHex = encKey.toString('hex');
  }

  // Return user without sensitive fields
  const { password_hash, enc_salt, enc_key_encrypted, ...safeUser } = user;
  return { ...safeUser, encKey: encKeyHex };
}

module.exports = {
  register,
  login,
};
