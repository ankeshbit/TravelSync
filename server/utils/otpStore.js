/**
 * OTP store backed by Prisma PostgreSQL model (Otp).
 * Survives server restarts and works seamlessly across multiple instances.
 *
 * Features:
 * - Cryptographically secure 6-digit generation via crypto.randomInt(100000, 1000000)
 * - HMAC-SHA256 hashing with timing-safe comparison (crypto.timingSafeEqual)
 * - Resend cooldown of 60 seconds
 * - Attempts counter (max 5 incorrect tries, then invalidates)
 * - Automated and opportunistic cleanup of expired records
 */

const crypto = require('crypto');
const config = require('../config/env');
const { prisma } = require('../db');

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

/**
 * Hash an OTP using HMAC-SHA256 with the server secret.
 * Always produces a 64-character hex string (32 bytes).
 *
 * @param {string|number} otp
 * @returns {string} 64-char hex digest
 */
function hashOtp(otp) {
  const secret = config.JWT_SECRET || 'travelsync-otp-secret-key-min-32chars';
  return crypto.createHmac('sha256', secret).update(String(otp)).digest('hex');
}

/**
 * Safely compare two hex-encoded hashes using crypto.timingSafeEqual.
 *
 * @param {string} hashA
 * @param {string} hashB
 * @returns {boolean}
 */
function compareHashes(hashA, hashB) {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Clean up expired OTP records from the database.
 *
 * @returns {Promise<number>} Count of deleted records
 */
async function cleanupExpiredOtps() {
  try {
    const result = await prisma.otp.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    return result.count;
  } catch (err) {
    console.error('[OtpStore] Error cleaning up expired OTPs:', err.message);
    return 0;
  }
}

/**
 * Generate a 6-digit OTP, enforce resend cooldown, store hash in DB, and return plain-text OTP.
 *
 * @param {string} email
 * @param {string} purpose - 'register' | 'delete'
 * @returns {Promise<string>} 6-digit plain text OTP
 */
async function createOtp(email, purpose) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Opportunistic cleanup of expired rows
  cleanupExpiredOtps().catch(() => {});

  // Check for resend cooldown on active OTP
  const existing = await prisma.otp.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existing) {
    const elapsed = now.getTime() - new Date(existing.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      const error = new Error(`Please wait ${waitSeconds}s before requesting a new code.`);
      error.statusCode = 429;
      error.cooldownSeconds = waitSeconds;
      throw error;
    }
  }

  // Invalidate any existing OTPs for this email & purpose
  await prisma.otp.deleteMany({
    where: {
      email: normalizedEmail,
      purpose
    }
  });

  // Generate cryptographically secure 6-digit OTP: [100000, 1000000)
  const otp = String(crypto.randomInt(100000, 1000000));
  const hash = hashOtp(otp);
  const expiresAt = new Date(now.getTime() + EXPIRY_MS);

  await prisma.otp.create({
    data: {
      email: normalizedEmail,
      hash,
      purpose,
      expiresAt,
      attempts: 0
    }
  });

  return otp;
}

/**
 * Verify an OTP.
 * Max 5 wrong attempts before invalidating.
 * Uses crypto.timingSafeEqual for hash comparison.
 *
 * @param {string} email
 * @param {string|number} candidateOtp
 * @param {string} purpose
 * @returns {Promise<{ ok: boolean, reason?: string, attemptsRemaining?: number }>}
 */
async function verifyOtp(email, candidateOtp, purpose) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const entry = await prisma.otp.findFirst({
    where: {
      email: normalizedEmail,
      purpose
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!entry) {
    return { ok: false, reason: 'No verification code found. Please request a new one.' };
  }

  // Check if expired
  if (now > new Date(entry.expiresAt)) {
    await prisma.otp.deleteMany({ where: { email: normalizedEmail, purpose } });
    return { ok: false, reason: 'Verification code has expired. Please request a new one.' };
  }

  // Check if already reached max attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    await prisma.otp.deleteMany({ where: { email: normalizedEmail, purpose } });
    return {
      ok: false,
      reason: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.'
    };
  }

  // Hash candidate and compare using crypto.timingSafeEqual
  const candidateHash = hashOtp(candidateOtp);
  const isMatch = compareHashes(candidateHash, entry.hash);

  if (!isMatch) {
    const newAttempts = entry.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      // Exceeded max attempts: invalidate code
      await prisma.otp.deleteMany({ where: { email: normalizedEmail, purpose } });
      return {
        ok: false,
        reason: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
        attemptsRemaining: 0
      };
    }

    await prisma.otp.update({
      where: { id: entry.id },
      data: { attempts: newAttempts }
    });

    const attemptsRemaining = MAX_ATTEMPTS - newAttempts;
    return {
      ok: false,
      reason: 'Incorrect verification code. Please try again.',
      attemptsRemaining
    };
  }

  // Successful verification: delete OTP record (single-use)
  await prisma.otp.deleteMany({ where: { email: normalizedEmail, purpose } });
  return { ok: true };
}

// Background cleanup interval (runs every 5 minutes, unref'd so it doesn't hold process open)
const cleanupInterval = setInterval(() => {
  cleanupExpiredOtps().catch(() => {});
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = {
  createOtp,
  verifyOtp,
  cleanupExpiredOtps,
  hashOtp,
  compareHashes,
  EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS
};
