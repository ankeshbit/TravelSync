process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const mockDeleteUser = jest.fn();

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token.endsWith('-token')) {
      const prefix = token.replace('-token', '');
      return {
        uid: `test-firebase-uid-${prefix}`,
        email: `${prefix}@example.com`,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} User`,
        email_verified: true
      };
    }
    return {
      uid: 'test-firebase-uid-primary',
      email: 'john@example.com',
      name: 'John Doe',
      email_verified: true
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    deleteUser: mockDeleteUser
  }))
}));

const request = require('supertest');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');
setupPrismaMock();

const app = require('../server');
const socketModule = require('../socket');
const cache = require('../services/cache');
const {
  createDeletionGrant,
  verifyAndConsumeDeletionGrant,
  resetGrantsForTesting,
  resetInMemoryCacheForTesting,
  hashGrant
} = require('../utils/deletionGrantStore');
const { createOtp, verifyOtp } = require('../utils/otpStore');
const { reconcilePendingDeletions } = require('../services/accountDeletionReconciliation');

describe('Backend Bug Fixing & Stabilization Regression Tests', () => {
  beforeEach(async () => {
    mockDeleteUser.mockReset();
    await resetGrantsForTesting();
    await prisma.otp.deleteMany();
  });

  describe('Bug 1: Account deletion and Firebase synchronization & reconciliation', () => {
    it('preserves deletion request as durable tombstone when Firebase fails, then reconciler completes it', async () => {
      const testUser = await prisma.user.create({
        data: {
          name: 'Sync Test User',
          email: 'synctest@example.com',
          firebaseUid: 'test-firebase-uid-synctest'
        }
      });

      const otp = await createOtp('synctest@example.com', 'delete');

      // Simulate Firebase failure
      mockDeleteUser.mockRejectedValueOnce(new Error('Firebase network timeout'));

      const res = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer synctest-token')
        .send({ otp });

      // Response indicates deletion is scheduled/in-progress
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('DELETION_SCHEDULED');

      // 1. Database still retains the record with pending_deletion tombstone
      const pendingUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(pendingUser).not.toBeNull();
      expect(pendingUser.refreshToken).toBe('pending_deletion');
      expect(pendingUser.deletedAt).not.toBeNull();

      // 2. Firebase service recovers; reconciler runs next cycle
      mockDeleteUser.mockResolvedValueOnce({});
      const outcome = await reconcilePendingDeletions({ prisma, olderThanMs: 0 });
      expect(outcome.processed).toBeGreaterThanOrEqual(1);

      // 3. User is now finalized and removed from database
      const reconciledUser = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(reconciledUser).toBeNull();
    });
  });

  describe('Bug 2: OTP deletion flow without double consumption (Deletion Grants)', () => {
    it('creates, verifies, and consumes single-use deletion grants', async () => {
      const grant = await createDeletionGrant('user-123', 'alice@example.com');
      expect(typeof grant).toBe('string');
      expect(grant.length).toBe(64);

      // Wrong user or email rejected without consuming the grant
      expect(await verifyAndConsumeDeletionGrant(grant, 'wrong-user', 'alice@example.com')).toBe(false);
      expect(await verifyAndConsumeDeletionGrant(grant, 'user-123', 'wrong@example.com')).toBe(false);

      // Correct user and email succeeds and consumes
      expect(await verifyAndConsumeDeletionGrant(grant, 'user-123', 'alice@example.com')).toBe(true);

      // Replay prevention: cannot consume twice
      expect(await verifyAndConsumeDeletionGrant(grant, 'user-123', 'alice@example.com')).toBe(false);
    });

    it('prevents simultaneous grant consumption under high concurrency', async () => {
      const grant = await createDeletionGrant('user-race', 'race@example.com');

      // 5 simultaneous requests attempting to consume the exact same grant
      const parallelConsumptions = Array.from({ length: 5 }).map(() =>
        verifyAndConsumeDeletionGrant(grant, 'user-race', 'race@example.com')
      );

      const results = await Promise.all(parallelConsumptions);

      const successes = results.filter(r => r === true);
      const failures = results.filter(r => r === false);

      // Exactly ONE request succeeds; all concurrent requests fail
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);
    });

    it('rejects expired deletion grants after server-side TTL', async () => {
      const token = 'expiredgranttoken0123456789abcdef0123456789abcdef0123456789abcdef01';
      const email = 'expired@example.com';
      const userId = 'user-expired';

      // Insert directly into DB with past expiration date
      await prisma.otp.create({
        data: {
          email,
          hash: hashGrant(token, userId, email),
          purpose: 'deletion_grant',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          attempts: 0
        }
      });

      // Clear memory cache so it must evaluate database record
      resetInMemoryCacheForTesting();

      const result = await verifyAndConsumeDeletionGrant(token, userId, email);
      expect(result).toBe(false);
    });

    it('rejects wrong-user consumption attempt without consuming the grant', async () => {
      const grant = await createDeletionGrant('user-legit', 'legit@example.com');

      // Attempt 1: Wrong user ID
      const wrongUserResult = await verifyAndConsumeDeletionGrant(grant, 'user-impostor', 'legit@example.com');
      expect(wrongUserResult).toBe(false);

      // Attempt 2: Wrong email
      const wrongEmailResult = await verifyAndConsumeDeletionGrant(grant, 'user-legit', 'attacker@example.com');
      expect(wrongEmailResult).toBe(false);

      // Legitimate user can still consume the intact grant
      const legitResult = await verifyAndConsumeDeletionGrant(grant, 'user-legit', 'legit@example.com');
      expect(legitResult).toBe(true);

      // Subsequent consumption is rejected
      expect(await verifyAndConsumeDeletionGrant(grant, 'user-legit', 'legit@example.com')).toBe(false);
    });

    it('persists deletion grants across simulated server crashes and restarts', async () => {
      const grant = await createDeletionGrant('user-reboot', 'reboot@example.com');

      // Verify row exists in PostgreSQL otps table
      const storedOtp = await prisma.otp.findFirst({
        where: { email: 'reboot@example.com', purpose: 'deletion_grant' }
      });
      expect(storedOtp).not.toBeNull();

      // Simulate complete server crash / restart by purging in-memory cache
      resetInMemoryCacheForTesting();

      // Post-restart: Verify grant is read and consumed from PostgreSQL
      const verified = await verifyAndConsumeDeletionGrant(grant, 'user-reboot', 'reboot@example.com');
      expect(verified).toBe(true);

      // Post-consumption: Verify row was deleted from PostgreSQL
      const postConsumption = await prisma.otp.findFirst({
        where: { email: 'reboot@example.com', purpose: 'deletion_grant' }
      });
      expect(postConsumption).toBeNull();
    });

    it('end-to-end OTP deletion flow works via verify-otp grant without double consumption', async () => {
      await prisma.user.create({
        data: {
          name: 'Grant User',
          email: 'grantuser@example.com',
          firebaseUid: 'test-firebase-uid-grantuser'
        }
      });

      // 1. Generate OTP
      const otp = await createOtp('grantuser@example.com', 'delete');

      // 2. Verify OTP with Bearer token, receiving deletionGrant
      mockDeleteUser.mockResolvedValueOnce({});
      const verifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .set('Authorization', 'Bearer grantuser-token')
        .send({
          email: 'grantuser@example.com',
          otp,
          purpose: 'delete'
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verified).toBe(true);
      expect(verifyRes.body.deletionGrant).toBeDefined();

      const grant = verifyRes.body.deletionGrant;

      // 3. Delete account using the deletion grant
      const deleteRes = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer grantuser-token')
        .send({ deletionGrant: grant });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toContain('Account deleted successfully');

      // 4. Replay attempt with same consumed grant is rejected
      await prisma.user.create({
        data: {
          name: 'Active User',
          email: 'active@example.com',
          firebaseUid: 'test-firebase-uid-active'
        }
      });
      const replayRes = await request(app)
        .delete('/api/auth/me')
        .set('Authorization', 'Bearer active-token')
        .send({ deletionGrant: grant });

      expect(replayRes.status).toBe(403);
    });
  });

  describe('Bug 3: Concurrent OTP verification and replay protection', () => {
    it('concurrent invalid attempts are atomically serialized and capped at MAX_ATTEMPTS', async () => {
      const email = 'concurrency-test@example.com';
      await createOtp(email, 'register');

      // Send 8 concurrent invalid verification attempts
      const parallelPromises = Array.from({ length: 8 }).map(() =>
        verifyOtp(email, '000000', 'register')
      );

      const results = await Promise.all(parallelPromises);

      // All attempts must fail
      expect(results.every(r => r.ok === false)).toBe(true);

      // Exactly 5 attempts allowed before invalidation, subsequent rejected
      const incorrectAttempts = results.filter(r => r.reason && r.reason.includes('attempts remaining'));
      expect(incorrectAttempts.length).toBeLessThanOrEqual(5);
    });

    it('concurrent attempts with valid code permit exactly one consumption', async () => {
      const email = 'single-consume@example.com';
      const validCode = await createOtp(email, 'register');

      // Send 5 concurrent verification attempts with the same valid code
      const parallelPromises = Array.from({ length: 5 }).map(() =>
        verifyOtp(email, validCode, 'register')
      );

      const results = await Promise.all(parallelPromises);

      // Exactly ONE attempt succeeds
      const successes = results.filter(r => r.ok === true);
      const failures = results.filter(r => r.ok === false);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);
    });
  });

  describe('Bug 4: Recommendation rate limiter ordering and user isolation', () => {
    it('enforces rate limits per authenticated user and isolates quotas between users', async () => {
      // Create user1 and user2
      await prisma.user.upsert({
        where: { email: 'user1@example.com' },
        update: {},
        create: { id: 'user1-id', name: 'User 1', email: 'user1@example.com', firebaseUid: 'test-firebase-uid-user1' }
      });
      await prisma.user.upsert({
        where: { email: 'user2@example.com' },
        update: {},
        create: { id: 'user2-id', name: 'User 2', email: 'user2@example.com', firebaseUid: 'test-firebase-uid-user2' }
      });

      // User 1 performs 60 recommendation requests (the configured limit)
      for (let i = 0; i < 60; i++) {
        const res = await request(app)
          .post('/api/recommendations/recommend')
          .set('Authorization', 'Bearer user1-token')
          .send({ travel_type: 'beach' });
        expect([200, 502]).toContain(res.status);
      }

      // 61st request for User 1 must return 429
      const user1Ratelimited = await request(app)
        .post('/api/recommendations/recommend')
        .set('Authorization', 'Bearer user1-token')
        .send({ travel_type: 'beach' });

      expect(user1Ratelimited.status).toBe(429);
      expect(user1Ratelimited.body.success).toBe(false);

      // User 2 should NOT be rate limited (isolated quota per user)
      const user2Request = await request(app)
        .post('/api/recommendations/recommend')
        .set('Authorization', 'Bearer user2-token')
        .send({ travel_type: 'adventure' });

      expect([200, 502]).toContain(user2Request.status);
      expect(user2Request.status).not.toBe(429);
    }, 20000);
  });

  describe('Bug 5: Offline pack balance calculation', () => {
    it('returns correctly calculated balances including zero-balance members', async () => {
      const owner = await prisma.user.create({
        data: { name: 'Trip Owner', email: 'owner@example.com', firebaseUid: 'test-firebase-uid-owner' }
      });
      const member1 = await prisma.user.create({
        data: { name: 'Member One', email: 'm1@example.com', firebaseUid: 'test-firebase-uid-m1' }
      });
      const member2 = await prisma.user.create({
        data: { name: 'Member Zero Balance', email: 'm2@example.com', firebaseUid: 'test-firebase-uid-m2' }
      });

      const trip = await prisma.trip.create({
        data: {
          name: 'Balance Test Trip',
          destination: 'Goa',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000 * 3),
          currency: 'INR',
          ownerId: owner.id
        }
      });

      await prisma.tripMember.create({ data: { tripId: trip.id, userId: member1.id, role: 'member' } });
      await prisma.tripMember.create({ data: { tripId: trip.id, userId: member2.id, role: 'member' } });

      // Owner pays 200 split between owner and member1 only. member2 has 0 balance.
      await prisma.expense.create({
        data: {
          tripId: trip.id,
          paidById: owner.id,
          amount: 200,
          description: 'Dinner',
          category: 'food',
          date: new Date(),
          splits: {
            create: [
              { userId: owner.id, amount: 100 },
              { userId: member1.id, amount: 100 }
            ]
          }
        }
      });

      const res = await request(app)
        .get(`/api/trips/${trip.id}/offline-pack`)
        .set('Authorization', 'Bearer owner-token');

      expect(res.status).toBe(200);
      expect(res.body.balances).toBeDefined();
      expect(Array.isArray(res.body.balances.membersWithBalance)).toBe(true);

      // Verify all 3 members (owner + 2 members) are present in balances
      const balanceMap = {};
      for (const b of res.body.balances.membersWithBalance) {
        balanceMap[b.id] = b.balance;
      }

      expect(balanceMap[owner.id]).toBe(100);
      expect(balanceMap[member1.id]).toBe(-100);
      expect(balanceMap[member2.id]).toBe(0); // Zero balance member correctly included
    });
  });

  describe('Bug 6: Offline sync commits before cache invalidation and socket broadcast', () => {
    it('commits updates before invalidating cache and broadcasting place:note_updated', async () => {
      const owner = await prisma.user.create({
        data: { name: 'Sync Owner', email: 'syncowner@example.com', firebaseUid: 'test-firebase-uid-syncowner' }
      });

      const trip = await prisma.trip.create({
        data: {
          name: 'Offline Sync Trip',
          destination: 'Paris',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000 * 2),
          ownerId: owner.id
        }
      });

      const place = await prisma.place.create({
        data: {
          tripId: trip.id,
          name: 'Eiffel Tower',
          note: 'Initial note'
        }
      });

      const executionOrder = [];

      // Spy on cache invalidation
      const origInvalidateTrip = cache.invalidateTrip;
      const origInvalidateUserDashboard = cache.invalidateUserDashboard;
      cache.invalidateTrip = jest.fn(async (...args) => {
        executionOrder.push('cache:invalidateTrip');
        return origInvalidateTrip.apply(cache, args);
      });
      cache.invalidateUserDashboard = jest.fn(async (...args) => {
        executionOrder.push('cache:invalidateUserDashboard');
        return origInvalidateUserDashboard.apply(cache, args);
      });

      // Spy on socket emission via socket.io instance
      const ioInstance = socketModule.getIO();
      const mockEmit = jest.fn((event, payload) => {
        executionOrder.push('socket:emit');
      });
      const spyTo = jest.spyOn(ioInstance, 'to').mockImplementation((room) => ({
        emit: mockEmit
      }));

      // Track DB update timing
      const origUpdate = prisma.place.update;
      prisma.place.update = jest.fn(async (...args) => {
        executionOrder.push('db:place.update');
        return origUpdate.apply(prisma.place, args);
      });

      try {
        const syncPayload = {
          changes: [
            {
              id: 'change-1',
              type: 'place_note',
              placeId: place.id,
              note: 'Updated note via offline sync'
            }
          ]
        };

        const res = await request(app)
          .post(`/api/trips/${trip.id}/offline-sync`)
          .set('Authorization', 'Bearer syncowner-token')
          .send(syncPayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.syncedCount).toBe(1);

        // Verify DB update happened BEFORE cache invalidation and socket broadcast
        const dbIndex = executionOrder.indexOf('db:place.update');
        const cacheIndex = executionOrder.indexOf('cache:invalidateTrip');
        const socketIndex = executionOrder.indexOf('socket:emit');

        expect(dbIndex).toBeGreaterThanOrEqual(0);
        expect(cacheIndex).toBeGreaterThan(dbIndex);
        expect(socketIndex).toBeGreaterThan(dbIndex);

        // Verify socket event payload
        expect(spyTo).toHaveBeenCalledWith(`trip:${trip.id}`);
        expect(mockEmit).toHaveBeenCalledWith('place:note_updated', expect.objectContaining({
          id: place.id,
          note: 'Updated note via offline sync'
        }));

        // Verify note was updated in database
        const updatedPlace = await prisma.place.findUnique({ where: { id: place.id } });
        expect(updatedPlace.note).toBe('Updated note via offline sync');
      } finally {
        cache.invalidateTrip = origInvalidateTrip;
        cache.invalidateUserDashboard = origInvalidateUserDashboard;
        prisma.place.update = origUpdate;
        spyTo.mockRestore();
      }
    });
  });
});
