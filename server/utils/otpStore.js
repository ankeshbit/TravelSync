/**
 * In-memory OTP store with automatic TTL expiry.
 * Key: email (lowercase)
 * Value: { hash: string, purpose: string, expiresAt: Date }
 *
 * For production scale, swap this for a MongoDB TTL collection or Redis.
 */
const bcrypt = require('bcryptjs');

const store = new Map();

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/** Generate a 6-digit OTP, store it hashed, and return the plain-text code. */
async function createOtp(email, purpose) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(otp, 8);
  store.set(email.toLowerCase(), {
    hash,
    purpose,
    expiresAt: new Date(Date.now() + EXPIRY_MS),
  });
  return otp; // plain text — sent via email, never stored
}

/** Verify an OTP. Returns true on success and removes the entry. */
async function verifyOtp(email, candidateOtp, purpose) {
  const entry = store.get(email.toLowerCase());
  if (!entry) return { ok: false, reason: 'No verification code found. Please request a new one.' };
  if (entry.purpose !== purpose) return { ok: false, reason: 'Invalid verification context.' };
  if (new Date() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return { ok: false, reason: 'Verification code has expired. Please request a new one.' };
  }
  const match = await bcrypt.compare(String(candidateOtp), entry.hash);
  if (!match) return { ok: false, reason: 'Incorrect verification code. Please try again.' };
  store.delete(email.toLowerCase()); // single-use
  return { ok: true };
}

/** Clean up expired entries periodically (every 5 min). */
setInterval(() => {
  const now = new Date();
  for (const [key, val] of store) {
    if (now > val.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { createOtp, verifyOtp };
