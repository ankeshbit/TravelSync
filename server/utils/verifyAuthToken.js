const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const { prisma, ensureUserSynced } = require('../db');
const logger = require('./logger');

// In-memory Neon session cache: token -> { userId, expiresAt, cachedAt }
const neonSessionCache = new Map();
const NEON_SESSION_TTL_MS = 10 * 1000; // 10 seconds cache

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

/**
 * Verify an authentication token (Neon session, Firebase ID token, or local JWT)
 * and return the associated Prisma User record.
 *
 * @param {string} token - Raw token string
 * @returns {Promise<object>} Prisma user object
 */
async function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') {
    const error = new Error('No token provided. Authorization denied.');
    error.statusCode = 401;
    throw error;
  }

  const cleanToken = token.trim();
  let verifiedUserId = null;

  // 1. Neon Auth session check (parameterised tagged template $queryRaw + cache)
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
      handleDatabaseError(dbErr, 'neon_auth.session query');
      // If error is not DB-down (e.g. neon_auth schema doesn't exist: 42P01), proceed to next auth providers
    }
  }

  if (verifiedUserId) {
    try {
      let user = await prisma.user.findUnique({ where: { id: verifiedUserId } });
      if (!user) {
        user = await ensureUserSynced(verifiedUserId);
      }
      if (user) return user;
    } catch (dbErr) {
      handleDatabaseError(dbErr, 'user lookup by neon session userId');
    }
  }

  // 2. Try Firebase Admin token verification
  try {
    const decodedFirebaseToken = await verifyFirebaseToken(cleanToken);
    if (decodedFirebaseToken && decodedFirebaseToken.uid) {
      const firebaseUid = decodedFirebaseToken.uid;
      const firebaseEmail = decodedFirebaseToken.email || '';
      const firebaseName = decodedFirebaseToken.name || firebaseEmail.split('@')[0] || 'User';
      const firebasePicture = decodedFirebaseToken.picture || '';

      try {
        // Look up user by firebaseUid (fast path for returning users)
        let user = await prisma.user.findFirst({ where: { firebaseUid } });

        if (!user && firebaseEmail) {
          // Link existing user created before Firebase migration by matching on email
          user = await prisma.user.findUnique({ where: { email: firebaseEmail } });
          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { firebaseUid }
            });
          }
        }

        if (!user) {
          // First-time login — auto-provision user record
          user = await prisma.user.create({
            data: {
              name: firebaseName,
              email: firebaseEmail,
              picture: firebasePicture,
              firebaseUid,
              password: ''
            }
          });
        }

        return user;
      } catch (dbErr) {
        handleDatabaseError(dbErr, 'Firebase user synchronization');
        throw dbErr;
      }
    }
  } catch (firebaseErr) {
    if (firebaseErr.statusCode === 503 || isDatabaseDownError(firebaseErr)) {
      throw firebaseErr;
    }
    // If Firebase verification fails, continue to local JWT check
  }

  // 3. Fallback: local JWT verification (for tests, dev, or local sessions)
  try {
    const secret = config.JWT_SECRET;
    if (secret) {
      const decoded = jwt.verify(cleanToken, secret);
      const userId = decoded.userId || decoded.id || decoded.sub;

      try {
        if (userId) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) return user;
        } else if (decoded.email) {
          const user = await prisma.user.findUnique({ where: { email: decoded.email } });
          if (user) return user;
        }
      } catch (dbErr) {
        handleDatabaseError(dbErr, 'JWT user lookup');
        throw dbErr;
      }
    }
  } catch (jwtErr) {
    if (jwtErr.statusCode === 503 || isDatabaseDownError(jwtErr)) {
      throw jwtErr;
    }
    // Fallback failed
  }

  const error = new Error('Invalid or expired token.');
  error.statusCode = 401;
  throw error;
}

module.exports = {
  verifyAuthToken,
  isDatabaseDownError,
  neonSessionCache,
  NEON_SESSION_TTL_MS
};
