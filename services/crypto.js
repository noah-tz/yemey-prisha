'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Generate a random salt for a new user.
 * @returns {string} hex-encoded salt
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Derive an AES-256 encryption key from a password and salt.
 * @param {string} password
 * @param {string} saltHex - hex-encoded salt
 * @returns {Buffer} 32-byte key
 */
function deriveKey(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext
 * @param {Buffer} key - 32-byte AES key
 * @returns {string} format: "iv:ciphertext:authTag" (all hex)
 */
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + encrypted + ':' + authTag;
}

/**
 * Decrypt an encrypted string.
 * @param {string} encryptedStr - format: "iv:ciphertext:authTag"
 * @param {Buffer} key - 32-byte AES key
 * @returns {string} decrypted plaintext
 */
function decrypt(encryptedStr, key) {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');

  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt a JSON-serializable object.
 * @param {Object} obj
 * @param {Buffer} key
 * @returns {string} encrypted string
 */
function encryptJSON(obj, key) {
  return encrypt(JSON.stringify(obj), key);
}

/**
 * Decrypt to a JSON object.
 * @param {string} encryptedStr
 * @param {Buffer} key
 * @returns {Object}
 */
function decryptJSON(encryptedStr, key) {
  return JSON.parse(decrypt(encryptedStr, key));
}

/**
 * Encrypt a user's encryption key for server-side storage (for API key auth).
 * Uses SESSION_SECRET as the wrapping key.
 * @param {Buffer} encKey - the user's 32-byte encryption key
 * @returns {string} encrypted key string
 */
function wrapKeyForStorage(encKey) {
  const secret = process.env.SESSION_SECRET || 'default-dev-secret';
  // Use a fixed salt for server-side key wrapping (deterministic from secret)
  const wrapSalt = crypto.createHash('sha256').update('enc-key-wrap-salt:' + secret).digest().toString('hex');
  const wrapKey = deriveKey(secret, wrapSalt);
  return encrypt(encKey.toString('hex'), wrapKey);
}

/**
 * Unwrap a stored encryption key (for API key auth / cron jobs).
 * @param {string} wrappedKey - encrypted key string from DB
 * @returns {Buffer} the user's 32-byte encryption key
 */
function unwrapKeyFromStorage(wrappedKey) {
  const secret = process.env.SESSION_SECRET || 'default-dev-secret';
  const wrapSalt = crypto.createHash('sha256').update('enc-key-wrap-salt:' + secret).digest().toString('hex');
  const wrapKey = deriveKey(secret, wrapSalt);
  const hexKey = decrypt(wrappedKey, wrapKey);
  return Buffer.from(hexKey, 'hex');
}

module.exports = {
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  wrapKeyForStorage,
  unwrapKeyFromStorage
};
