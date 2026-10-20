const { prisma: defaultPrisma } = require('../db');
const logger = require('../utils/logger');

/**
 * Background and on-demand reconciliation service for account deletions.
 *
 * Resolves inconsistent states where:
 * 1. Firebase user was deleted but PostgreSQL deletion failed (leaves user.deletedAt != null).
 * 2. Deletion was interrupted mid-flight or server restarted.
 *
 * Safety policy:
 * - Idempotently deletes Firebase user if still present.
 * - If user has no foreign-key dependencies (expenses/splits): deletes PostgreSQL user record completely.
 * - If user has foreign-key dependencies (expenses/splits): preserves financial history by retaining
 *   the record as an anonymized tombstone (scrubbing PII: name, picture, email, password) with deletedAt set.
 *   This ensures trips, split balances, and expense records are never corrupted.
 * - Never resets an account to active if Firebase user has already been deleted.
 *
 * @param {object} options
 * @param {object} [options.prisma] - Prisma client instance (defaults to shared db instance)
 * @param {object} [options.firebaseAuth] - Firebase auth instance
 * @param {number} [options.olderThanMs=0] - Minimum age of pending deletion in ms (defaults to 0 for immediate)
 * @returns {Promise<{ processed: number, deleted: number, anonymized: number, errors: Array<{ userId: string, message: string }> }>}
 */
async function reconcilePendingDeletions({
  prisma: dbClient = defaultPrisma,
  firebaseAuth,
  olderThanMs = 0
} = {}) {
  const result = {
    processed: 0,
    deleted: 0,
    anonymized: 0,
    errors: []
  };

  try {
    const cutoff = new Date(Date.now() - olderThanMs);
    const pendingUsers = await dbClient.user.findMany({
      where: {
        deletedAt: { not: null }
      }
    });

    const eligibleUsers = pendingUsers.filter(u => !u.deletedAt || new Date(u.deletedAt) <= cutoff);

    for (const user of eligibleUsers) {
      result.processed++;
      try {
        // 1. Ensure Firebase account is deleted
        if (user.firebaseUid) {
          try {
            let auth = firebaseAuth;
            if (!auth) {
              const { getAdminApp } = require('../config/firebaseAdmin');
              const { getAuth } = require('firebase-admin/auth');
              auth = getAuth(getAdminApp());
            }
            if (auth && typeof auth.deleteUser === 'function') {
              await auth.deleteUser(user.firebaseUid);
            }
          } catch (fbErr) {
            const isNotFound = fbErr && (
              fbErr.code === 'auth/user-not-found' ||
              String(fbErr.message || '').includes('user-not-found')
            );
            if (!isNotFound) {
              logger.warn(
                { userId: user.id, err: fbErr.message },
                '[Reconciliation] Failed to delete Firebase user during reconciliation'
              );
              result.errors.push({ userId: user.id, message: fbErr.message });
              continue;
            }
          }
        }

        // 2. Check foreign key dependencies
        const [expensesPaidCount, expenseSplitsCount, tripExpensesCount] = await Promise.all([
          dbClient.expense.count({ where: { paidById: user.id } }),
          dbClient.expenseSplit.count({ where: { userId: user.id } }),
          dbClient.expense.count({ where: { trip: { ownerId: user.id } } })
        ]);

        if (expensesPaidCount === 0 && expenseSplitsCount === 0 && tripExpensesCount === 0) {
          // Clean deletion: remove memberships, owned empty trips, and user record
          await dbClient.$transaction(async (tx) => {
            await tx.tripMember.deleteMany({ where: { userId: user.id } });
            await tx.trip.deleteMany({ where: { ownerId: user.id } });
            await tx.user.delete({ where: { id: user.id } });
          });
          result.deleted++;
          logger.info({ userId: user.id }, '[Reconciliation] Cleanly deleted pending user from database');
        } else {
          // User has shared financial history: preserve integrity by anonymizing PII
          await dbClient.user.update({
            where: { id: user.id },
            data: {
              name: 'Deleted User',
              email: `deleted-${user.id}@deleted.travelsync.local`,
              picture: '',
              password: '',
              refreshToken: 'deleted'
            }
          });
          result.anonymized++;
          logger.info(
            { userId: user.id, expensesPaidCount, expenseSplitsCount },
            '[Reconciliation] Anonymized user profile with preserved financial records'
          );
        }
      } catch (err) {
        logger.error({ userId: user.id, err: err.message }, '[Reconciliation] Error reconciling user');
        result.errors.push({ userId: user.id, message: err.message });
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Reconciliation] Failed to query pending deletion users');
  }

  return result;
}

module.exports = {
  reconcilePendingDeletions
};
