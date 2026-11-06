process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';

const idempotencyStore = require('../utils/idempotencyStore');
const cache = require('../services/cache');
const config = require('../config/env');

describe('Distributed Expense Idempotency & Crash-Safe Concurrency Locking', () => {
  beforeEach(() => {
    idempotencyStore._clearForTesting();
    cache._setCacheClientForTesting(null);
  });

  afterEach(() => {
    idempotencyStore._clearForTesting();
    cache._setCacheClientForTesting(null);
  });

  describe('1. Atomic Locking & Concurrency Protection', () => {
    it('acquires lock when no request is in-flight', async () => {
      const lock = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-alpha', 10);
      expect(lock.acquired).toBe(true);
      expect(typeof lock.lockToken).toBe('string');
      expect(lock.lockToken.length).toBeGreaterThan(10);
    });

    it('rejects concurrent request with identical key in flight', async () => {
      const lock1 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-beta', 10);
      expect(lock1.acquired).toBe(true);

      const lock2 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-beta', 10);
      expect(lock2.acquired).toBe(false);
      expect(lock2.lockToken).toBeNull();
    });

    it('releases lock cleanly so retry can proceed after failure', async () => {
      const lock1 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-gamma', 10);
      expect(lock1.acquired).toBe(true);

      // Request fails, releases lock using ownership token
      await idempotencyStore.releaseLock('user-1', 'trip-1', 'key-gamma', lock1.lockToken);

      // Retry attempt acquires lock successfully
      const lock2 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-gamma', 10);
      expect(lock2.acquired).toBe(true);
    });

    it('safe lock release: stale request with mismatched token CANNOT release active lock', async () => {
      const lock1 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-delta', 10);
      expect(lock1.acquired).toBe(true);

      // Stale request with wrong token attempts to release lock
      await idempotencyStore.releaseLock('user-1', 'trip-1', 'key-delta', 'stale-expired-token-uuid');

      // Lock should still be held by lock1!
      const lock2 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-delta', 10);
      expect(lock2.acquired).toBe(false);

      // Releasing with valid token releases successfully
      await idempotencyStore.releaseLock('user-1', 'trip-1', 'key-delta', lock1.lockToken);
      const lock3 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'key-delta', 10);
      expect(lock3.acquired).toBe(true);
    });
  });

  describe('2. Multi-Tenant & Multi-Trip Isolation', () => {
    it('isolates keys by user: User B is NOT blocked by User A using the same key', async () => {
      const lockUserA = await idempotencyStore.acquireLock('user-A', 'trip-1', 'shared-uuid-key', 10);
      expect(lockUserA.acquired).toBe(true);

      const lockUserB = await idempotencyStore.acquireLock('user-B', 'trip-1', 'shared-uuid-key', 10);
      expect(lockUserB.acquired).toBe(true);
    });

    it('isolates keys by trip: Trip B is NOT blocked by Trip A using the same key', async () => {
      const lockTripA = await idempotencyStore.acquireLock('user-1', 'trip-A', 'shared-trip-key', 10);
      expect(lockTripA.acquired).toBe(true);

      const lockTripB = await idempotencyStore.acquireLock('user-1', 'trip-B', 'shared-trip-key', 10);
      expect(lockTripB.acquired).toBe(true);
    });

    it('does NOT return User A cached expense to User B', async () => {
      const expenseA = { id: 'exp-A', title: 'Lunch A', amount: 50 };
      await idempotencyStore.saveExpense('user-A', 'trip-1', 'same-key', expenseA);

      // User A gets cached expense
      const cachedA = await idempotencyStore.getCachedExpense('user-A', 'trip-1', 'same-key');
      expect(cachedA).not.toBeNull();
      expect(cachedA.data).toEqual(expenseA);

      // User B gets null
      const cachedB = await idempotencyStore.getCachedExpense('user-B', 'trip-1', 'same-key');
      expect(cachedB).toBeNull();
    });
  });

  describe('3. Deterministic Payload Hashing & Mismatch Detection', () => {
    it('generates identical hash for identical payloads regardless of split order', () => {
      const payload1 = {
        title: 'Dinner at Tokyo',
        amount: '120.50',
        currency: 'USD',
        category: 'food',
        paidBy: 'user-1',
        splitAmong: ['user-2', 'user-1']
      };
      const payload2 = {
        title: 'Dinner at Tokyo',
        amount: 120.50,
        currency: 'USD',
        category: 'food',
        paidBy: 'user-1',
        splitAmong: ['user-1', 'user-2']
      };

      const hash1 = idempotencyStore.computePayloadHash(payload1);
      const hash2 = idempotencyStore.computePayloadHash(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('generates different hash when amount, currency, or title differs', () => {
      const base = {
        title: 'Taxi',
        amount: 30,
        currency: 'EUR',
        category: 'transport',
        paidBy: 'user-1',
        splitAmong: ['user-1']
      };
      const alteredAmount = { ...base, amount: 35 };
      const alteredTitle = { ...base, title: 'Uber' };

      const baseHash = idempotencyStore.computePayloadHash(base);
      const amountHash = idempotencyStore.computePayloadHash(alteredAmount);
      const titleHash = idempotencyStore.computePayloadHash(alteredTitle);

      expect(baseHash).not.toBe(amountHash);
      expect(baseHash).not.toBe(titleHash);
    });
  });

  describe('4. Redis Distributed Mutex (SET NX EX)', () => {
    it('uses Redis SET NX EX atomically when Redis is available', async () => {
      const redisStore = new Map();
      const mockClient = {
        status: 'ready',
        get: jest.fn(async (key) => redisStore.get(key) ?? null),
        set: jest.fn(async (key, val, _ex, _ttl, nx) => {
          if (nx === 'NX' && redisStore.has(key)) {
            return null; // Atomic conflict
          }
          redisStore.set(key, val);
          return 'OK';
        }),
        del: jest.fn(async (key) => {
          redisStore.delete(key);
          return 1;
        }),
        eval: jest.fn(async (_lua, _numKeys, key, token) => {
          if (redisStore.get(key) === token) {
            redisStore.delete(key);
            return 1;
          }
          return 0;
        })
      };

      cache._setCacheClientForTesting(mockClient);

      // Request 1 acquires distributed lock in Redis
      const lock1 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'distributed-key', 10);
      expect(lock1.acquired).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'ts:idemp:lock:user-1:trip-1:distributed-key',
        lock1.lockToken,
        'EX',
        10,
        'NX'
      );

      // Request 2 hits Redis SET NX EX which returns null (already locked)
      const lock2 = await idempotencyStore.acquireLock('user-1', 'trip-1', 'distributed-key', 10);
      expect(lock2.acquired).toBe(false);

      // Release lock removes from Redis via atomic Lua evaluation
      await idempotencyStore.releaseLock('user-1', 'trip-1', 'distributed-key', lock1.lockToken);
      expect(mockClient.eval).toHaveBeenCalled();
    });

    it('fails safely with 503 if Redis is required in production but fails', async () => {
      const mockFailingClient = {
        status: 'ready',
        set: jest.fn().mockRejectedValue(new Error('Redis cluster connection timeout'))
      };
      cache._setCacheClientForTesting(mockFailingClient);

      // Temporarily simulate production mode with REDIS_URL configured
      const originalIsProd = config.isProduction;
      const originalRedisUrl = config.REDIS_URL;
      config.isProduction = true;
      config.REDIS_URL = 'redis://production-cache:6379';

      try {
        await expect(
          idempotencyStore.acquireLock('user-1', 'trip-1', 'prod-key', 10)
        ).rejects.toMatchObject({
          statusCode: 503,
          code: 'IDEMPOTENCY_UNAVAILABLE'
        });
      } finally {
        config.isProduction = originalIsProd;
        config.REDIS_URL = originalRedisUrl;
      }
    });
  });

  describe('5. Expense Persistence & Retries', () => {
    it('returns original expense on retry and releases lock automatically', async () => {
      const expenseData = { id: 'exp-999', title: 'Train Tickets', amount: 45, currency: 'EUR' };
      const hash = idempotencyStore.computePayloadHash({ title: 'Train Tickets', amount: 45, currency: 'EUR' });

      const lock = await idempotencyStore.acquireLock('user-1', 'trip-1', 'ticket-key', 10);
      await idempotencyStore.saveExpense('user-1', 'trip-1', 'ticket-key', expenseData, hash, 3600, lock.lockToken);

      // Subsequent query returns cached data and hash
      const cached = await idempotencyStore.getCachedExpense('user-1', 'trip-1', 'ticket-key');
      expect(cached).not.toBeNull();
      expect(cached.data).toEqual(expenseData);
      expect(cached.hash).toBe(hash);

      // Lock should have been released by saveExpense
      const canAcquireAgain = await idempotencyStore.acquireLock('user-1', 'trip-1', 'ticket-key', 10);
      expect(canAcquireAgain.acquired).toBe(true);
    });
  });
});
