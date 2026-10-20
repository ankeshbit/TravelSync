process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '1';

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'user-b-token') {
      return {
        uid: 'firebase-uid-user-b',
        email: 'userb@example.com',
        name: 'User B'
      };
    }
    return {
      uid: 'firebase-uid-user-a',
      email: 'usera@example.com',
      name: 'User A'
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

const request = require('supertest');
const { setupPrismaMock } = require('./mockPrisma');
const { prisma } = require('../db');
const {
  sanitizeRedisError,
  getRedisStatus,
  isRedisReady,
  closeRedis,
  _setRedisClientForTesting
} = require('../config/redis');
const cache = require('../services/cache');
const config = require('../config/env');

setupPrismaMock();

const app = require('../server');

describe('Redis Configuration & Centralized Client', () => {
  afterEach(async () => {
    _setRedisClientForTesting(null);
  });

  describe('sanitizeRedisError', () => {
    it('redacts passwords in standard redis:// URLs', () => {
      const err = new Error('Connection failed to redis://:superSecretPassword123@my-redis-host:6379');
      const sanitized = sanitizeRedisError(err);
      expect(sanitized).not.toContain('superSecretPassword123');
      expect(sanitized).toContain('redis://***:***@my-redis-host:6379');
    });

    it('redacts credentials in rediss:// TLS URLs with usernames', () => {
      const msg = 'Error on rediss://default:token_abc_123@cache.internal:6380/0';
      const sanitized = sanitizeRedisError(msg);
      expect(sanitized).not.toContain('token_abc_123');
      expect(sanitized).toContain('rediss://***:***@cache.internal:6380/0');
    });

    it('returns empty string for null/undefined input', () => {
      expect(sanitizeRedisError(null)).toBe('');
      expect(sanitizeRedisError(undefined)).toBe('');
    });
  });

  describe('getRedisStatus & isRedisReady', () => {
    it('reports not configured when REDIS_URL is falsy', () => {
      const orig = config.REDIS_URL;
      config.REDIS_URL = '';
      try {
        const status = getRedisStatus();
        expect(status).toEqual({ configured: false, status: 'not configured' });
        expect(isRedisReady()).toBe(false);
      } finally {
        config.REDIS_URL = orig;
      }
    });

    it('reports disconnected when REDIS_URL is set but client is null', () => {
      const orig = config.REDIS_URL;
      config.REDIS_URL = 'redis://localhost:6379';
      _setRedisClientForTesting(null);
      try {
        const status = getRedisStatus();
        expect(status).toEqual({ configured: true, status: 'disconnected' });
        expect(isRedisReady()).toBe(false);
      } finally {
        config.REDIS_URL = orig;
      }
    });

    it('reports ready status when injected client status is ready', () => {
      const orig = config.REDIS_URL;
      config.REDIS_URL = 'redis://localhost:6379';
      _setRedisClientForTesting({ status: 'ready' });
      try {
        const status = getRedisStatus();
        expect(status).toEqual({ configured: true, status: 'ready' });
        expect(isRedisReady()).toBe(true);
      } finally {
        config.REDIS_URL = orig;
      }
    });
  });

  describe('closeRedis', () => {
    it('safely quits or disconnects client without error', async () => {
      const mockClient = {
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn()
      };
      _setRedisClientForTesting(mockClient);
      await closeRedis();
      expect(mockClient.quit).toHaveBeenCalled();
      expect(getRedisStatus().status).toBe(config.REDIS_URL ? 'disconnected' : 'not configured');
    });

    it('falls back to disconnect if quit throws', async () => {
      const mockClient = {
        quit: jest.fn().mockRejectedValue(new Error('Connection lost')),
        disconnect: jest.fn()
      };
      _setRedisClientForTesting(mockClient);
      await closeRedis();
      expect(mockClient.quit).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });
});

describe('Cache Service Core (get, set, del, delPattern)', () => {
  let mockStore;
  let mockClient;

  beforeEach(() => {
    mockStore = new Map();
    mockClient = {
      status: 'ready',
      get: jest.fn(async (key) => mockStore.get(key) ?? null),
      set: jest.fn(async (key, val, _ex, _ttl) => {
        mockStore.set(key, val);
        return 'OK';
      }),
      del: jest.fn(async (...keys) => {
        let count = 0;
        keys.forEach(k => {
          if (mockStore.delete(k)) count++;
        });
        return count;
      }),
      scan: jest.fn(async (cursor, matchKey, pattern, _countKey, _countVal) => {
        const prefix = pattern.replace('*', '');
        const matchingKeys = Array.from(mockStore.keys()).filter(k => k.startsWith(prefix));
        return ['0', matchingKeys];
      }),
      quit: jest.fn().mockResolvedValue('OK')
    };
    _setRedisClientForTesting(mockClient);
  });

  afterEach(async () => {
    _setRedisClientForTesting(null);
  });

  it('stores and retrieves cached JSON objects', async () => {
    const data = { id: 'trip-123', name: 'Goa Holiday', budget: 15000 };
    const saved = await cache.set('ts:trip:trip-123:user-1', data, 300);
    expect(saved).toBe(true);

    const retrieved = await cache.get('ts:trip:trip-123:user-1');
    expect(retrieved).toEqual(data);
  });

  it('returns null on cache miss', async () => {
    const res = await cache.get('ts:nonexistent:key');
    expect(res).toBeNull();
  });

  it('handles malformed JSON gracefully by returning null and deleting corrupted key', async () => {
    mockStore.set('ts:corrupt:key', 'INVALID_JSON{{{');
    const res = await cache.get('ts:corrupt:key');
    expect(res).toBeNull();
    expect(mockClient.del).toHaveBeenCalledWith('ts:corrupt:key');
  });

  it('deletes specific cache keys via del', async () => {
    mockStore.set('ts:delete:me', JSON.stringify({ ok: true }));
    const deleted = await cache.del('ts:delete:me');
    expect(deleted).toBe(true);
    expect(mockStore.has('ts:delete:me')).toBe(false);
  });

  it('deletes matching keys via delPattern', async () => {
    mockStore.set('ts:trip:100:user1', JSON.stringify({ id: 100 }));
    mockStore.set('ts:trip:100:user2', JSON.stringify({ id: 100 }));
    mockStore.set('ts:trip:200:user1', JSON.stringify({ id: 200 }));

    const count = await cache.delPattern('ts:trip:100:*');
    expect(count).toBe(2);
    expect(mockStore.has('ts:trip:100:user1')).toBe(false);
    expect(mockStore.has('ts:trip:100:user2')).toBe(false);
    expect(mockStore.has('ts:trip:200:user1')).toBe(true);
  });

  it('handles Redis client errors gracefully without throwing', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Connection reset by peer'));
    const getRes = await cache.get('ts:test:fail');
    expect(getRes).toBeNull();

    mockClient.set.mockRejectedValueOnce(new Error('OOM command not allowed'));
    const setRes = await cache.set('ts:test:fail', { hello: 'world' });
    expect(setRes).toBe(false);

    mockClient.del.mockRejectedValueOnce(new Error('Cluster node down'));
    const delRes = await cache.del('ts:test:fail');
    expect(delRes).toBe(false);
  });

  it('returns null and does not throw when Redis is disconnected', async () => {
    _setRedisClientForTesting(null);
    expect(await cache.get('ts:any:key')).toBeNull();
    expect(await cache.set('ts:any:key', { data: 1 })).toBe(false);
    expect(await cache.del('ts:any:key')).toBe(false);
    expect(await cache.delPattern('ts:any:*')).toBe(0);
  });

  describe('Invalidation helpers', () => {
    it('invalidateUserDashboard deletes dashboard keys for single or multiple users', async () => {
      mockStore.set('ts:dashboard:user-1', JSON.stringify({ stats: 1 }));
      mockStore.set('ts:dashboard:user-2', JSON.stringify({ stats: 2 }));
      mockStore.set('ts:dashboard:user-3', JSON.stringify({ stats: 3 }));

      await cache.invalidateUserDashboard(['user-1', 'user-2']);
      expect(mockStore.has('ts:dashboard:user-1')).toBe(false);
      expect(mockStore.has('ts:dashboard:user-2')).toBe(false);
      expect(mockStore.has('ts:dashboard:user-3')).toBe(true);
    });

    it('invalidateTrip clears trip details for all members and AI suggestion keys', async () => {
      mockStore.set('ts:trip:trip-99:user-1', JSON.stringify({ id: 'trip-99' }));
      mockStore.set('ts:trip:trip-99:user-2', JSON.stringify({ id: 'trip-99' }));
      mockStore.set('ts:ai:plan:trip-99:hash123', JSON.stringify({ plan: 'Goa day 1' }));
      mockStore.set('ts:trip:trip-88:user-1', JSON.stringify({ id: 'trip-88' }));

      await cache.invalidateTrip('trip-99', ['user-1', 'user-2']);
      expect(mockStore.has('ts:trip:trip-99:user-1')).toBe(false);
      expect(mockStore.has('ts:trip:trip-99:user-2')).toBe(false);
      expect(mockStore.has('ts:ai:plan:trip-99:hash123')).toBe(false);
      expect(mockStore.has('ts:trip:trip-88:user-1')).toBe(true);
    });

    it('invalidateExplore clears explore cached keys', async () => {
      mockStore.set('ts:explore:destinations:all', JSON.stringify([]));
      mockStore.set('ts:explore:destinations:user1', JSON.stringify([]));
      mockStore.set('ts:dashboard:user1', JSON.stringify({}));

      await cache.invalidateExplore();
      expect(mockStore.has('ts:explore:destinations:all')).toBe(false);
      expect(mockStore.has('ts:explore:destinations:user1')).toBe(false);
      expect(mockStore.has('ts:dashboard:user1')).toBe(true);
    });
  });
});

describe('HTTP Endpoint Caching and Invalidation Integration', () => {
  let mockStore;
  let mockClient;
  let userA;
  let _userB;

  beforeEach(async () => {
    mockStore = new Map();
    mockClient = {
      status: 'ready',
      get: jest.fn(async (key) => mockStore.get(key) ?? null),
      set: jest.fn(async (key, val) => {
        mockStore.set(key, val);
        return 'OK';
      }),
      del: jest.fn(async (...keys) => {
        keys.forEach(k => mockStore.delete(k));
        return keys.length;
      }),
      scan: jest.fn(async (cursor, matchKey, pattern) => {
        const prefix = pattern.replace('*', '');
        const matchingKeys = Array.from(mockStore.keys()).filter(k => k.startsWith(prefix));
        return ['0', matchingKeys];
      }),
      quit: jest.fn().mockResolvedValue('OK')
    };
    _setRedisClientForTesting(mockClient);

    // Seed mock DB users
    userA = await prisma.user.create({
      data: {
        firebaseUid: 'firebase-uid-user-a',
        email: 'usera@example.com',
        name: 'User A',
        currency: 'INR'
      }
    });

    _userB = await prisma.user.create({
      data: {
        firebaseUid: 'firebase-uid-user-b',
        email: 'userb@example.com',
        name: 'User B',
        currency: 'USD'
      }
    });
  });

  afterEach(async () => {
    _setRedisClientForTesting(null);
  });

  describe('Health Probes with Redis Status', () => {
    it('GET /api/health includes safe redis status without secrets', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.redis).toBeDefined();
      expect(res.body.redis.status).toBe('ready');
      expect(JSON.stringify(res.body)).not.toContain('localhost:6379');
    });

    it('GET /api/health/ready includes safe redis status', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.redis).toBeDefined();
      expect(res.body.redis.status).toBe('ready');
    });
  });

  describe('GET /api/explore/destinations', () => {
    it('returns X-Cache: MISS on first request and HIT on subsequent request', async () => {
      const firstRes = await request(app)
        .get('/api/explore/destinations')
        .set('Authorization', 'Bearer user-a-token');
      expect(firstRes.status).toBe(200);
      expect(firstRes.headers['x-cache']).toBe('MISS');

      const secondRes = await request(app)
        .get('/api/explore/destinations')
        .set('Authorization', 'Bearer user-a-token');
      expect(secondRes.status).toBe(200);
      expect(secondRes.headers['x-cache']).toBe('HIT');
      expect(secondRes.body).toEqual(firstRes.body);
    });
  });

  describe('Dashboard and Trip Caching Lifecycle', () => {
    it('caches /api/trips/summary and invalidates it when a new trip is created', async () => {
      // 1. First summary call -> MISS
      const res1 = await request(app)
        .get('/api/trips/summary')
        .set('Authorization', 'Bearer user-a-token');
      expect(res1.status).toBe(200);
      expect(res1.headers['x-cache']).toBe('MISS');

      // 2. Second summary call -> HIT
      const res2 = await request(app)
        .get('/api/trips/summary')
        .set('Authorization', 'Bearer user-a-token');
      expect(res2.status).toBe(200);
      expect(res2.headers['x-cache']).toBe('HIT');

      // 3. User B has isolated cache (tenant isolation)
      const resUserB = await request(app)
        .get('/api/trips/summary')
        .set('Authorization', 'Bearer user-b-token');
      expect(resUserB.status).toBe(200);
      expect(resUserB.headers['x-cache']).toBe('MISS');

      // 4. Create a trip -> invalidates user A's dashboard cache
      const createRes = await request(app)
        .post('/api/trips')
        .set('Authorization', 'Bearer user-a-token')
        .send({
          name: 'Himalayan Trek',
          destination: 'Manali',
          startDate: '2026-06-01',
          endDate: '2026-06-08',
          currency: 'INR'
        });
      expect(createRes.status).toBe(201);
      const tripId = createRes.body.id;

      // 5. Subsequent summary call for User A is MISS again
      const res3 = await request(app)
        .get('/api/trips/summary')
        .set('Authorization', 'Bearer user-a-token');
      expect(res3.status).toBe(200);
      expect(res3.headers['x-cache']).toBe('MISS');

      // 6. Fetch trip detail -> MISS then HIT
      const tripRes1 = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(tripRes1.status).toBe(200);
      expect(tripRes1.headers['x-cache']).toBe('MISS');

      const tripRes2 = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(tripRes2.status).toBe(200);
      expect(tripRes2.headers['x-cache']).toBe('HIT');

      // 7. Reorder places -> invalidates trip cache
      const reorderRes = await request(app)
        .patch(`/api/trips/${tripId}/places/reorder`)
        .set('Authorization', 'Bearer user-a-token')
        .send([]);
      expect(reorderRes.status).toBe(200);

      const tripRes3 = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(tripRes3.status).toBe(200);
      expect(tripRes3.headers['x-cache']).toBe('MISS');
    });

    it('adding and deleting an expense invalidates trip cache and member dashboards', async () => {
      // Create trip owned by User A
      const createTripRes = await request(app)
        .post('/api/trips')
        .set('Authorization', 'Bearer user-a-token')
        .send({
          name: 'Goa Weekend',
          destination: 'Goa',
          startDate: '2026-07-01',
          endDate: '2026-07-04',
          currency: 'INR'
        });
      const tripId = createTripRes.body.id;

      // Prime the trip cache
      const primeTrip = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(primeTrip.headers['x-cache']).toBe('MISS');

      const cachedTrip = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(cachedTrip.headers['x-cache']).toBe('HIT');

      const ownerId = createTripRes.body.owner?.id || userA.id;

      // Add expense
      const addExpenseRes = await request(app)
        .post(`/api/trips/${tripId}/expenses`)
        .set('Authorization', 'Bearer user-a-token')
        .send({
          title: 'Beach Shack Dinner',
          amount: 2500,
          currency: 'INR',
          category: 'food',
          paidBy: ownerId,
          splitAmong: [ownerId]
        });
      expect(addExpenseRes.status).toBe(201);
      const expenseId = addExpenseRes.body.id;

      // Trip cache must be invalidated
      const tripAfterExpense = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(tripAfterExpense.headers['x-cache']).toBe('MISS');

      // Delete expense
      const deleteExpenseRes = await request(app)
        .delete(`/api/trips/${tripId}/expenses/${expenseId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(deleteExpenseRes.status).toBe(200);

      // Trip cache must be invalidated again
      const tripAfterDelete = await request(app)
        .get(`/api/trips/${tripId}`)
        .set('Authorization', 'Bearer user-a-token');
      expect(tripAfterDelete.headers['x-cache']).toBe('MISS');
    });
  });
});
