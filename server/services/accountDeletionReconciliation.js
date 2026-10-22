const path = require('path');
const fs = require('fs');
const { prisma: defaultPrisma } = require('../db');
const logger = require('../utils/logger');

/**
 * Deletes or anonymizes a user in PostgreSQL based on financial records.
 * - If user has expenses paid, splits, or trips with expenses:
 *   Removes trip memberships, and updates user row to anonymized tombstone:
 *   name: 'Deleted User', email: `deleted-${id}@deleted.travelsync.local`, picture: '',
 *   password: '', firebaseUid: null, refreshToken: 'deleted', deletedAt set.
 * - If user has no financial history:
 *   Hard-deletes memberships, owned empty trips, and user row.
 *
 * @param {object} dbClient - Prisma client instance
 * @param {object} user - User record (id, firebaseUid, deletedAt, picture)
 * @returns {Promise<{ deleted: boolean, anonymized: boolean }>}
 */
async function deleteOrAnonymizeUser(dbClient, user) {
  const [expensesPaidCount, expenseSplitsCount, tripExpensesCount] = await Promise.all([
    dbClient.expense.count({ where: { paidById: user.id } }),
    dbClient.expenseSplit.count({ where: { userId: user.id } }),
    dbClient.expense.count({ where: { trip: { ownerId: user.id } } })
  ]);

  const hasFinancialHistory = expensesPaidCount > 0 || expenseSplitsCount > 0 || tripExpensesCount > 0;

  const performDbWork = async (tx) => {
    // Delete user's TripMember rows
    await tx.tripMember.deleteMany({ where: { userId: user.id } });

    if (!hasFinancialHistory) {
      await tx.trip.deleteMany({ where: { ownerId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
      return { deleted: true, anonymized: false };
    } else {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: 'Deleted User',
          email: `deleted-${user.id}@deleted.travelsync.local`,
          picture: '',
          password: '',
          firebaseUid: null,
          refreshToken: 'deleted',
          deletedAt: user.deletedAt || new Date()
        }
      });
      return { deleted: false, anonymized: true };
    }
  };

  if (typeof dbClient.$transaction === 'function') {
    return await dbClient.$transaction(performDbWork);
  }
  return await performDbWork(dbClient);
}

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

        // 2. Perform DB deletion or anonymization
        const outcome = await deleteOrAnonymizeUser(dbClient, user);
        if (outcome.deleted) {
          result.deleted++;
          logger.info({ userId: user.id }, '[Reconciliation] Cleanly deleted pending user from database');
        } else {
          result.anonymized++;
          logger.info(
            { userId: user.id },
            '[Reconciliation] Anonymized user profile with preserved financial records'
          );
        }

        // Clean up uploaded photo if any
        if (user.picture && user.picture.startsWith('/uploads/')) {
          const photoPath = path.join(__dirname, '..', user.picture);
          try {
            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
          } catch (_e) {
            // Ignore photo deletion errors on disk
          }
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
  deleteOrAnonymizeUser,
  reconcilePendingDeletions
};
