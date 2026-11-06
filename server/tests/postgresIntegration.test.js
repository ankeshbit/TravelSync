/**
 * Real PostgreSQL Integration Test Suite.
 *
 * Exercises real database constraints, foreign keys, transaction rollbacks,
 * simultaneous concurrency, and multi-table operations.
 *
 * Requirements:
 * - Requires a live PostgreSQL database (via TEST_DATABASE_URL or local DATABASE_URL).
 * - Never runs against production data.
 * - Safely cleans up only test records created during the run.
 * - If no live PostgreSQL server is reachable, gracefully skips with a descriptive notice.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const testDbUrl = process.env.TEST_DATABASE_URL ||
  (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/test') ? process.env.DATABASE_URL : null) ||
  'postgresql://postgres@127.0.0.1:5433/travelsync_test?sslmode=disable';
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;

// Guard: Never run integration tests against production URLs
function isSafeTestUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('prod') || lower.includes('live')) {
    return false;
  }
  return true;
}

describe('PostgreSQL Live Integration Suite', () => {
  let prisma = null;
  let isDbConnected = false;

  const testSuffix = `integ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const testEmail = `user-${testSuffix}@test.travelsync.local`;
  const otherEmail = `other-${testSuffix}@test.travelsync.local`;

  let createdUserId = null;
  let otherUserId = null;
  let createdTripId = null;
  let createdExpenseId = null;

  beforeAll(async () => {
    if (!isSafeTestUrl(testDbUrl)) {
      console.warn(`[Integration] Skipping: ${testDbUrl} is not marked as a safe test database.`);
      return;
    }

    process.env.DATABASE_URL = testDbUrl;
    process.env.DIRECT_URL = testDbUrl;
    process.env.OTP_SECRET = process.env.OTP_SECRET || 'test-secret-at-least-32-chars-long-validation-ok';

    // Reset global.__prisma so all application services connect to test DB
    if (global.__prisma) {
      await global.__prisma.$disconnect().catch(() => {});
      global.__prisma = null;
    }

    try {
      prisma = new PrismaClient({
        datasources: { db: { url: testDbUrl } },
        log: ['error']
      });

      // Quick probe with timeout
      await Promise.race([
        prisma.$queryRaw`SELECT 1 as connected;`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout to PostgreSQL')), 6000))
      ]);
      isDbConnected = true;
      global.__prisma = prisma;
    } catch (err) {
      isDbConnected = false;
      console.info(`[Integration] Notice: Live PostgreSQL not available (${err.message}). Integration tests will be skipped.`);
    }
  });

  afterAll(async () => {
    if (prisma && isDbConnected) {
      try {
        // Clean up only our specific test records in reverse dependency order
        if (createdExpenseId) {
          await prisma.expenseSplit.deleteMany({ where: { expenseId: createdExpenseId } }).catch(() => {});
          await prisma.expense.deleteMany({ where: { id: createdExpenseId } }).catch(() => {});
        }
        if (createdTripId) {
          await prisma.tripMember.deleteMany({ where: { tripId: createdTripId } }).catch(() => {});
          await prisma.place.deleteMany({ where: { tripId: createdTripId } }).catch(() => {});
          await prisma.expenseSplit.deleteMany({ where: { expense: { tripId: createdTripId } } }).catch(() => {});
          await prisma.expense.deleteMany({ where: { tripId: createdTripId } }).catch(() => {});
          await prisma.activity.deleteMany({ where: { tripId: createdTripId } }).catch(() => {});
          await prisma.trip.deleteMany({ where: { id: createdTripId } }).catch(() => {});
        }
        await prisma.otp.deleteMany({ where: { email: { in: [testEmail, otherEmail] } } }).catch(() => {});
        if (createdUserId) {
          await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => {});
        }
        if (otherUserId) {
          await prisma.user.deleteMany({ where: { id: otherUserId } }).catch(() => {});
        }
      } catch (cleanupErr) {
        console.warn('[Integration] Cleanup error:', cleanupErr.message);
      } finally {
        await prisma.$disconnect().catch(() => {});
      }
    }
  });

  const conditionalTest = (name, fn) => {
    it(name, async () => {
      if (!isDbConnected) {
        console.warn(`[SKIPPED] ${name}: Live PostgreSQL is not connected.`);
        return;
      }
      await fn();
    });
  };

  describe('1. OTP System on Real Database', () => {
    conditionalTest('creates OTP and verifies atomic consumption', async () => {
      const { createOtp, verifyOtp } = require('../utils/otpStore');

      const otp = await createOtp(testEmail, 'register');
      expect(typeof otp).toBe('string');
      expect(otp).toHaveLength(6);

      // Verify row exists in real database
      const row = await prisma.otp.findFirst({ where: { email: testEmail, purpose: 'register' } });
      expect(row).not.toBeNull();

      // Verify and consume
      const result = await verifyOtp(testEmail, otp, 'register');
      expect(result.ok).toBe(true);

      // Verify row was deleted atomically
      const deletedRow = await prisma.otp.findFirst({ where: { email: testEmail, purpose: 'register' } });
      expect(deletedRow).toBeNull();
    });

    conditionalTest('prevents simultaneous verification of the same OTP (concurrency race)', async () => {
      const { createOtp, verifyOtp } = require('../utils/otpStore');
      const otp = await createOtp(otherEmail, 'delete');

      // Launch two concurrent verify requests
      const [res1, res2] = await Promise.all([
        verifyOtp(otherEmail, otp, 'delete'),
        verifyOtp(otherEmail, otp, 'delete')
      ]);

      // Exactly one must succeed, the other must fail due to atomic deleteMany isolation
      const okCount = [res1.ok, res2.ok].filter(Boolean).length;
      expect(okCount).toBe(1);

      const failedRes = res1.ok ? res2 : res1;
      expect(failedRes.ok).toBe(false);
      expect(failedRes.reason).toMatch(/already been used|expired|no verification code found/i);
    });
  });

  describe('2. Expense Creation, Splits, and Constraint Integrity', () => {
    conditionalTest('creates user, trip, expense, and splits with real foreign keys', async () => {
      // 1. Create real users
      const user = await prisma.user.create({
        data: {
          name: 'Test Owner',
          email: testEmail,
          password: 'hashed-password-123'
        }
      });
      createdUserId = user.id;

      const member = await prisma.user.create({
        data: {
          name: 'Test Member',
          email: otherEmail,
          password: 'hashed-password-456'
        }
      });
      otherUserId = member.id;

      // 2. Create real trip
      const trip = await prisma.trip.create({
        data: {
          name: 'Goa Real DB Trip',
          destination: 'Goa',
          startDate: new Date('2026-12-01'),
          endDate: new Date('2026-12-05'),
          ownerId: user.id,
          currency: 'INR',
          members: {
            create: [{ userId: member.id }]
          }
        }
      });
      createdTripId = trip.id;

      // 3. Create expense with splits and idempotency key
      const idempotencyKey = `idemp-${testSuffix}`;
      const expense = await prisma.expense.create({
        data: {
          tripId: trip.id,
          title: 'Resort Booking',
          amount: 10000,
          currency: 'INR',
          paidById: user.id,
          idempotencyKey,
          requestHash: 'test-payload-hash-123',
          splits: {
            create: [
              { userId: user.id },
              { userId: member.id }
            ]
          }
        },
        include: {
          splits: true,
          paidBy: true
        }
      });
      createdExpenseId = expense.id;

      expect(expense.id).toBeDefined();
      expect(expense.splits).toHaveLength(2);
      expect(expense.paidById).toBe(user.id);
      expect(expense.idempotencyKey).toBe(idempotencyKey);
    });

    conditionalTest('enforces database-level unique constraint on (tripId, idempotencyKey)', async () => {
      const idempotencyKey = `idemp-${testSuffix}`;

      let duplicateError = null;
      try {
        await prisma.expense.create({
          data: {
            tripId: createdTripId,
            title: 'Duplicate Resort Attempt',
            amount: 10000,
            currency: 'INR',
            paidById: createdUserId,
            idempotencyKey, // Reusing existing idempotencyKey in the same trip
            splits: {
              create: [{ userId: createdUserId }]
            }
          }
        });
      } catch (err) {
        duplicateError = err;
      }

      // Assert PostgreSQL unique constraint rejected duplicate
      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code === 'P2002' || duplicateError.message.includes('unique constraint') || duplicateError.message.includes('23505')).toBe(true);
    });

    conditionalTest('verifies transaction rollback on constraint violation', async () => {
      // Attempt a multi-operation transaction where the second operation violates a unique constraint
      let txError = null;
      try {
        await prisma.$transaction(async (tx) => {
          // Operation A: Insert a temporary place
          await tx.place.create({
            data: {
              id: `place-tx-${testSuffix}`,
              tripId: createdTripId,
              name: 'Temporary Beach',
              address: 'North Goa',
              lat: 15.5,
              lng: 73.8,
              dayNumber: 1,
              orderIndex: 99
            }
          });

          // Operation B: Violate unique constraint by re-inserting user with same email
          await tx.user.create({
            data: {
              name: 'Duplicate Email User',
              email: testEmail // already exists
            }
          });
        });
      } catch (err) {
        txError = err;
      }

      // Assert transaction threw an error
      expect(txError).not.toBeNull();

      // Assert Operation A was rolled back: the temporary place must NOT exist in database
      const place = await prisma.place.findUnique({
        where: { id: `place-tx-${testSuffix}` }
      });
      expect(place).toBeNull();
    });

    conditionalTest('verifies RESTRICT constraint prevents user deletion with outstanding expenses', async () => {
      // otherUserId is in expense.splits
      // Attempting to delete otherUserId directly should trigger foreign key RESTRICT constraint (code 23001)
      let deleteError = null;
      try {
        await prisma.user.delete({
          where: { id: otherUserId }
        });
      } catch (err) {
        deleteError = err;
      }

      // Foreign key on expense_splits has ON DELETE RESTRICT
      expect(deleteError).not.toBeNull();
      const isRestrictViolation = deleteError.code === 'P2003' ||
        deleteError.message.includes('violates RESTRICT setting') ||
        deleteError.message.includes('23001');
      expect(isRestrictViolation).toBe(true);
    });

    conditionalTest('verifies account deletion anonymization preserves financial ledger integrity', async () => {
      const accountDeletion = require('../services/accountDeletionReconciliation');

      const userToDelete = await prisma.user.findUnique({
        where: { id: otherUserId },
        include: {
          ownedTrips: true,
          memberTrips: true
        }
      });

      // User has expenses/splits -> must be anonymized, not hard-deleted
      const outcome = await accountDeletion.deleteOrAnonymizeUser(prisma, userToDelete);
      expect(outcome.anonymized).toBe(true);
      expect(outcome.deleted).toBe(false);

      // Check DB row was updated with tombstone
      const anonymizedUser = await prisma.user.findUnique({ where: { id: otherUserId } });
      expect(anonymizedUser).not.toBeNull();
      expect(anonymizedUser.name).toBe('Deleted User');
      expect(anonymizedUser.deletedAt).not.toBeNull();

      // Check that the expense split row was preserved intact
      const splits = await prisma.expenseSplit.findMany({ where: { expenseId: createdExpenseId } });
      expect(splits).toHaveLength(2);
      expect(splits.some(s => s.userId === otherUserId)).toBe(true);
    });
  });
});
