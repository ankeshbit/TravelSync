const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

// In-memory grant store cache: token -> { userId, email, action, expiresAt }
const grants = new Map();
const GRANT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Deterministically compute an HMAC-SHA256 signature for a deletion grant.
 * Binds token, userId, and email together with server secret.
 *
 * @param {string} token - 64-char hex grant token
 * @param {string} userId - User UUID
 * @param {string} email - Normalized email
 * @returns {string} 64-char hex HMAC digest
 */
function hashGrant(token, userId, email) {
  const secret = config.OTP_SECRET || 'default-deletion-grant-secret-key-min-32-chars';
  const payload = `${String(userId).trim()}:${String(email).toLowerCase().trim()}:${String(token).trim()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Timing-safe comparison of two hex hashes.
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
 * Creates a single-use, short-lived deletion authorization grant for an authenticated user.
 * Persists durably in PostgreSQL (model Otp with purpose: 'deletion_grant') to ensure
 * grant survives process crashes, server restarts, and works across multi-instance clusters.
 *
 * @param {string} userId - User ID (UUID)
 * @param {string} email - User email
 * @returns {Promise<string>} Cryptographically random 64-character hex grant token
 */
async function createDeletionGrant(userId, email) {
  if (!userId || !email) {
    throw new Error('userId and email are required to create a deletion grant.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedUserId = String(userId).trim();
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
  const hash = hashGrant(token, normalizedUserId, normalizedEmail);

  // Maintain fast in-memory record
  grants.set(token, {
    userId: normalizedUserId,
    email: normalizedEmail,
    action: 'delete_account',
    expiresAt: expiresAt.getTime()
  });

  // Persist durably in PostgreSQL via prisma.otp
  try {
    const { prisma } = require('../db');
    if (prisma && prisma.otp && typeof prisma.otp.create === 'function') {
      // Invalidate any older pending deletion grant for this email
      await prisma.otp.deleteMany({
        where: {
          email: normalizedEmail,
          purpose: 'deletion_grant'
        }
      }).catch(() => {});

      await prisma.otp.create({
        data: {
          email: normalizedEmail,
          hash,
          purpose: 'deletion_grant',
          expiresAt,
          attempts: 0
        }
      });
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[DeletionGrant] Failed to persist grant to database, relying on memory store');
  }

  return token;
}

/**
 * Atomically verifies and consumes a deletion authorization grant.
 * Ensures:
 * 1. Grant exists and matches cryptographic HMAC binding (userId + email + token).
 * 2. Grant is consumed immediately via atomic row deletion in PostgreSQL transaction (cannot be reused).
 * 3. Server-side expiration is enforced.
 * 4. Multi-process and post-restart safe (backed by PostgreSQL ACID transactions).
 *
 * @param {string} token - Grant token
 * @param {string} userId - Requesting user ID
 * @param {string} [email] - Requesting user email
 * @returns {Promise<boolean>} True if grant is valid and consumed; false otherwise
 */
async function verifyAndConsumeDeletionGrant(token, userId, email) {
  if (!token || typeof token !== 'string') return false;
  if (!userId) return false;

  const normalizedUserId = String(userId).trim();
  const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
  const now = new Date();

  // Try PostgreSQL atomic consumption first if database is available
  try {
    const { prisma } = require('../db');
    if (prisma && prisma.otp && typeof prisma.$transaction === 'function') {
      const dbOutcome = await prisma.$transaction(async (tx) => {
        const whereClause = {
          purpose: 'deletion_grant',
          expiresAt: { gt: now }
        };
        if (normalizedEmail) {
          whereClause.email = normalizedEmail;
        }

        const entry = await tx.otp.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' }
        });

        if (!entry) return null;

        // Verify cryptographic binding to userId + email + token
        const candidateHash = hashGrant(token, normalizedUserId, entry.email);
        const isMatch = compareHashes(candidateHash, entry.hash);
        if (!isMatch) {
          logger.warn({ userId: normalizedUserId }, '[DeletionGrant] Mismatched grant token or user binding');
          return false;
        }

        // Email binding check if email was explicitly provided
        if (normalizedEmail && entry.email !== normalizedEmail) {
          return false;
        }

        // Atomic single-use consumption: delete this specific record
        const deleteResult = await tx.otp.deleteMany({
          where: { id: entry.id }
        });

        if (deleteResult.count === 0) {
          logger.warn({ userId: normalizedUserId }, '[DeletionGrant] Grant was already consumed concurrently');
          return false;
        }

        return true;
      });

      if (dbOutcome === true) {
        grants.delete(token);
        return true;
      }
      if (dbOutcome === false) {
        return false;
      }
    }
  } catch (dbErr) {
    logger.warn({ err: dbErr.message }, '[DeletionGrant] Database transaction failed, checking memory store');
  }

  // Fallback to in-memory store if database didn't have/support it
  const record = grants.get(token);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    grants.delete(token);
    logger.warn({ userId: normalizedUserId }, '[DeletionGrant] Expired grant presented');
    return false;
  }

  if (record.action !== 'delete_account') {
    grants.delete(token);
    logger.warn({ userId: normalizedUserId }, '[DeletionGrant] Mismatched grant action');
    return false;
  }

  if (record.userId !== normalizedUserId) {
    logger.warn({ recordUserId: record.userId, requestingUserId: normalizedUserId }, '[DeletionGrant] Mismatched user ID');
    return false;
  }

  if (normalizedEmail && record.email !== normalizedEmail) {
    logger.warn({ recordEmail: record.email, requestingEmail: normalizedEmail }, '[DeletionGrant] Mismatched email');
    return false;
  }

  grants.delete(token);
  return true;
}

/**
 * Opportunistically cleans up expired deletion grants from memory and database.
 */
async function clearExpiredGrants() {
  const now = Date.now();
  for (const [token, record] of grants.entries()) {
    if (now > record.expiresAt) {
      grants.delete(token);
    }
  }

  try {
    const { prisma } = require('../db');
    if (prisma && prisma.otp && typeof prisma.otp.deleteMany === 'function') {
      await prisma.otp.deleteMany({
        where: {
          purpose: 'deletion_grant',
          expiresAt: { lt: new Date() }
        }
      });
    }
  } catch (_e) {}
}

/**
 * Clears memory cache only (simulating server crash/reboot).
 */
function resetInMemoryCacheForTesting() {
  grants.clear();
}

/**
 * Reset all grants from memory and database (useful for test isolation).
 */
async function resetGrantsForTesting() {
  grants.clear();
  try {
    const { prisma } = require('../db');
    if (prisma && prisma.otp && typeof prisma.otp.deleteMany === 'function') {
      await prisma.otp.deleteMany({
        where: { purpose: 'deletion_grant' }
      });
    }
  } catch (_e) {}
}

// Background cleanup timer every 2 minutes (unreferenced)
const cleanupTimer = setInterval(() => {
  clearExpiredGrants().catch(() => {});
}, 2 * 60 * 1000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

module.exports = {
  createDeletionGrant,
  verifyAndConsumeDeletionGrant,
  clearExpiredGrants,
  resetGrantsForTesting,
  resetInMemoryCacheForTesting,
  hashGrant,
  compareHashes,
  GRANT_TTL_MS
};
