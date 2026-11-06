const crypto = require('crypto');
const logger = require('./logger');

// In-memory grant store: token -> { userId, email, action, expiresAt }
const grants = new Map();
const GRANT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a single-use, short-lived deletion authorization grant for an authenticated user.
 *
 * @param {string} userId - User ID (UUID)
 * @param {string} email - User email
 * @returns {string} Cryptographically random 64-character hex grant token
 */
function createDeletionGrant(userId, email) {
  if (!userId || !email) {
    throw new Error('userId and email are required to create a deletion grant.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const record = {
    userId: String(userId),
    email: String(email).toLowerCase().trim(),
    action: 'delete_account',
    expiresAt: Date.now() + GRANT_TTL_MS
  };

  grants.set(token, record);
  return token;
}

/**
 * Atomically verifies and consumes a deletion authorization grant.
 * Ensures:
 * 1. Grant exists.
 * 2. Grant is consumed immediately (cannot be reused).
 * 3. Grant has not expired.
 * 4. Grant action matches 'delete_account'.
 * 5. Grant is bound to the requesting userId and email.
 *
 * @param {string} token - Grant token
 * @param {string} userId - Requesting user ID
 * @param {string} [email] - Requesting user email
 * @returns {boolean} True if grant is valid and consumed; false otherwise
 */
function verifyAndConsumeDeletionGrant(token, userId, email) {
  if (!token || typeof token !== 'string') return false;

  const record = grants.get(token);
  if (!record) return false;

  // Check TTL expiration
  if (Date.now() > record.expiresAt) {
    grants.delete(token);
    logger.warn({ userId }, '[DeletionGrant] Expired grant presented');
    return false;
  }

  // Check action binding
  if (record.action !== 'delete_account') {
    grants.delete(token);
    logger.warn({ userId }, '[DeletionGrant] Mismatched grant action');
    return false;
  }

  // Check user binding
  if (record.userId !== String(userId)) {
    logger.warn({ recordUserId: record.userId, requestingUserId: userId }, '[DeletionGrant] Mismatched user ID');
    return false;
  }

  // Check email binding if provided
  if (email && record.email !== String(email).toLowerCase().trim()) {
    logger.warn({ recordEmail: record.email, requestingEmail: email }, '[DeletionGrant] Mismatched email');
    return false;
  }

  // Single-use: consume immediately so it cannot be replayed
  grants.delete(token);
  return true;
}

/**
 * Opportunistically cleans up expired deletion grants.
 */
function clearExpiredGrants() {
  const now = Date.now();
  for (const [token, record] of grants.entries()) {
    if (now > record.expiresAt) {
      grants.delete(token);
    }
  }
}

/**
 * Reset all grants (useful for test isolation).
 */
function resetGrantsForTesting() {
  grants.clear();
}

// Background cleanup timer every 2 minutes (unreferenced)
const cleanupTimer = setInterval(clearExpiredGrants, 2 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

module.exports = {
  createDeletionGrant,
  verifyAndConsumeDeletionGrant,
  clearExpiredGrants,
  resetGrantsForTesting,
  GRANT_TTL_MS
};
