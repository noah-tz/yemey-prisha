const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');

const SALT_ROUNDS = 12;

/**
 * Register a new user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {{ id: number, email: string, posek: string, created_at: string }}
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

  try {
    const user = userRepository.create(email, hash);
    return user;
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      throw new Error('Email already registered');
    }
    throw err;
  }
}

/**
 * Authenticate a user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {{ id: number, email: string, posek: string, created_at: string }}
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

  // Return user without password_hash
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  register,
  login,
};
