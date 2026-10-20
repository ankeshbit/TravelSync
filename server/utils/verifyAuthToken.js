const config = require('../config/env');
const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const { prisma, ensureUserSynced } = require('../db');
const logger = require('./logger');

// In-memory Neon session cache: token -> { userId, expiresAt, cachedAt }
const neonSessionCache = new Map();
const NEON_SESSION_TTL_MS = 10 * 1000; // 10 seconds cache

const deletedAccountsCache = new Set();
const pendingDeletionUids = new Set();

function markUserPendingDeletion(firebaseUid) {
  if (firebaseUid) pendingDeletionUids.add(firebaseUid);
}

function unmarkUserPendingDeletion(firebaseUid) {
  if (firebaseUid) pendingDeletionUids.delete(firebaseUid);
}

function markUserDeleted(firebaseUid) {
  if (firebaseUid) {
    pendingDeletionUids.delete(firebaseUid);
    deletedAccountsCache.add(firebaseUid);
  }
}

function isUserDeletedOrPending(user) {
  if (!user) return false;
  if (user.deletedAt) return true;
  if (user.refreshToken === 'pending_deletion' || user.refreshToken === 'deleted') return true;
  return false;
}

/**
 * Determine if a caught error indicates that the database server is down or unreachable.
 *
 * @param {Error|any} err
 * @returns {boolean}
 */
function isDatabaseDownError(err) {
  if (!err) return false;
  if (err.statusCode === 503) return true;
  if (err.name === 'PrismaClientInitializationError') return true;
  if (err.name === 'PrismaClientRustPanicError') return true;
  if (['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017'].includes(err.code)) return true;

  const msg = String(err.message || '').toLowerCase();
  if (
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes("can't reach database server") ||
    msg.includes('connection pool timeout') ||
    msg.includes('database is shut down') ||
    msg.includes('server closed the connection')
  ) {
    return true;
  }
  return false;
}

/**
 * Helper to handle database exceptions: logs real DB errors and throws 503 if DB is down.
 *
 * @param {Error} err
 * @param {string} context
 */
function handleDatabaseError(err, context) {
  // Always log real DB errors instead of silently swallowing them
  logger.error({ err }, `[Auth] Database error in ${context}`);

  if (isDatabaseDownError(err)) {
    const serviceError = new Error('Database service unavailable.');
    serviceError.statusCode = 503;
    throw serviceError;
  }
}

let neonAuthMissingTableLogged = false;

/**
 * Verify an authentication token (Neon session, Firebase ID token, or local JWT)
 * and return the associated Prisma User record.
 *
 * @param {string} token - Raw token string
 * @returns {Promise<object>} Prisma user object
 */
async function verifyAuthToken(token, options = {}) {
  const allowPendingDeletion = options.allowPendingDeletion === true;
  if (!token || typeof token !== 'string') {
    const error = new Error('No token provided. Authorization denied.');
    error.statusCode = 401;
    throw error;
  }

  const cleanToken = token.trim();
  let verifiedUserId = null;

  // 0. Development fallback token for automated visual testing and inspection
  if (config.NODE_ENV !== 'production' && cleanToken === 'dev-token') {
    const devUser = await prisma.user.findFirst({ where: { email: 'ankeshsrivastava61289@gmail.com' } });
    if (devUser) return devUser;
  }

  // 1. Neon Auth session check (only if config.NEON_AUTH_ENABLED is true)
  if (config.NEON_AUTH_ENABLED) {
    const cached = neonSessionCache.get(cleanToken);
    if (cached && (Date.now() - cached.cachedAt < NEON_SESSION_TTL_MS)) {
      if (cached.expiresAt > Date.now()) {
        verifiedUserId = cached.userId;
      } else {
        neonSessionCache.delete(cleanToken);
      }
    }

    if (!verifiedUserId) {
      try {
        const sessionRows = await prisma.$queryRaw`
          SELECT "userId", "expiresAt" FROM neon_auth.session WHERE token = ${cleanToken} AND "expiresAt" > NOW()
        `;

        if (sessionRows && sessionRows.length > 0) {
          const row = sessionRows[0];
          verifiedUserId = row.userId;
          neonSessionCache.set(cleanToken, {
            userId: row.userId,
            expiresAt: new Date(row.expiresAt).getTime(),
            cachedAt: Date.now()
          });
        }
      } catch (dbErr) {
        if (dbErr.code === '42P01' || (dbErr.message && dbErr.message.includes('42P01'))) {
          if (!neonAuthMissingTableLogged) {
            neonAuthMissingTableLogged = true;
            logger.warn('neon_auth.session table does not exist (42P01).');
          }
        } else {
          handleDatabaseError(dbErr, 'neon_auth.session query');
        }
      }
    }

    if (verifiedUserId) {
      try {
        let user = await prisma.user.findUnique({ where: { id: verifiedUserId } });
        if (!user) {
          user = await ensureUserSynced(verifiedUserId);
        }
        if (user) {
          if (isUserDeletedOrPending(user)) {
            const err = new Error('Account has been deleted or is pending deletion.');
            err.statusCode = 401;
            err.code = 'ACCOUNT_DELETED';
            throw err;
          }
          return user;
        }
      } catch (dbErr) {
        handleDatabaseError(dbErr, 'user lookup by neon session userId');
      }
    }
  }

  // 2. Try Firebase Admin token verification
  let decodedFirebaseToken = null;
  try {
    decodedFirebaseToken = await verifyFirebaseToken(cleanToken);
  } catch (firebaseErr) {
    if (firebaseErr.statusCode === 503 || isDatabaseDownError(firebaseErr)) {
      throw firebaseErr;
    }
    // Token verification failed (invalid, expired, malformed) — fall through to 401 below
  }

  if (decodedFirebaseToken && decodedFirebaseToken.uid) {
    const firebaseUid = decodedFirebaseToken.uid;
    const firebaseEmail = decodedFirebaseToken.email || '';
    const firebaseName = decodedFirebaseToken.name || (firebaseEmail ? firebaseEmail.split('@')[0] : 'User');
    const firebasePicture = decodedFirebaseToken.picture || '';
    const isEmailVerified = decodedFirebaseToken.email_verified === true;

    // Deny immediately if UID is marked deleted, or pending deletion (unless allowPendingDeletion)
    if (deletedAccountsCache.has(firebaseUid) || (!allowPendingDeletion && pendingDeletionUids.has(firebaseUid))) {
      const err = new Error('Account has been deleted or is pending deletion.');
      err.statusCode = 401;
      err.code = 'ACCOUNT_DELETED';
      throw err;
    }

    try {
      // Look up user by firebaseUid (fast path for returning users)
      let user = await prisma.user.findFirst({ where: { firebaseUid } });
      if (user) {
        if (!allowPendingDeletion && isUserDeletedOrPending(user)) {
          const err = new Error('Account has been deleted or is pending deletion.');
          err.statusCode = 401;
          err.code = 'ACCOUNT_DELETED';
          throw err;
        }
        return user;
      }

      // Only link or create a user when decoded.email_verified === true
      if (!isEmailVerified) {
        if (firebaseEmail) {
          const existing = await prisma.user.findUnique({ where: { email: firebaseEmail } });
          if (existing) {
            const err = new Error('Email must be verified to link to an existing account.');
            err.statusCode = 401;
            throw err;
          }
        }
        const err = new Error('Email is not verified. Please verify your email.');
        err.statusCode = 403;
        err.code = 'EMAIL_NOT_VERIFIED';
        throw err;
      }

      // Email is verified: link existing user created before Firebase migration
      if (firebaseEmail) {
        user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
        if (user) {
          if (isUserDeletedOrPending(user)) {
            const err = new Error('Account has been deleted or is pending deletion.');
            err.statusCode = 401;
            err.code = 'ACCOUNT_DELETED';
            throw err;
          }
          user = await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid }
          });
          return user;
        }
      }

      // Do not auto-provision if marked deleted or pending deletion
      if (deletedAccountsCache.has(firebaseUid) || pendingDeletionUids.has(firebaseUid)) {
        const err = new Error('Account has been deleted or is pending deletion.');
        err.statusCode = 401;
        err.code = 'ACCOUNT_DELETED';
        throw err;
      }

      // First-time login — auto-provision user record with P2002 retry
      try {
        user = await prisma.user.create({
          data: {
            name: firebaseName,
            email: firebaseEmail,
            picture: firebasePicture,
            firebaseUid,
            password: ''
          }
        });
        return user;
      } catch (createErr) {
        if (createErr.code === 'P2002') {
          user = await prisma.user.findFirst({
            where: {
              OR: [
                { firebaseUid },
                ...(firebaseEmail ? [{ email: firebaseEmail }] : [])
              ]
            }
          });
          if (user) {
            if (isUserDeletedOrPending(user)) {
              const err = new Error('Account has been deleted or is pending deletion.');
              err.statusCode = 401;
              err.code = 'ACCOUNT_DELETED';
              throw err;
            }
            return user;
          }
        }
        throw createErr;
      }
    } catch (dbErr) {
      if (dbErr.statusCode === 401 || dbErr.statusCode === 403) {
        throw dbErr;
      }
      handleDatabaseError(dbErr, 'Firebase user synchronization');
      dbErr.statusCode = dbErr.statusCode || 500;
      throw dbErr;
    }
  }

  const error = new Error('Invalid or expired token.');
  error.statusCode = 401;
  throw error;
}

module.exports = {
  verifyAuthToken,
  isDatabaseDownError,
  neonSessionCache,
  NEON_SESSION_TTL_MS,
  markUserPendingDeletion,
  unmarkUserPendingDeletion,
  markUserDeleted,
  deletedAccountsCache,
  pendingDeletionUids
};
