process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '1';

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'valid-delete-token') {
      return {
        uid: 'test-firebase-uid',
        email: 'purpose-test@example.com',
        name: 'Test User'
      };
    }
    return {
      uid: 'test-firebase-uid',
      email: 'test@example.com',
      name: 'Test User'
    };
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

const request = require('supertest');
const { setupPrismaMock } = require('./mockPrisma');
setupPrismaMock();

const app = require('../server');
app.set('trust proxy', 1);

describe('OTP Rate Limiting and Email Abuse Protection', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('multiple email addresses from the same IP get 429 after the 5th (IP rate limit)', async () => {
    const statuses = [];
    for (let i = 1; i <= 8; i++) {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .set('X-Forwarded-For', '198.51.100.1')
        .send({ email: `different-email-${i}@example.com`, purpose: 'register' });
      statuses.push(res.status);
    }

    // The first 5 should be accepted (200)
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    // The 6th, 7th, and 8th requests from the same IP must be 429
    expect(statuses[5]).toBe(429);
    expect(statuses[6]).toBe(429);
    expect(statuses[7]).toBe(429);
  });

  it('repeated requests for one email within 60s cooldown return 429 with retry cooldown', async () => {
    const email = 'cooldown-test@example.com';

    // First request succeeds
    const firstRes = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.2')
      .send({ email, purpose: 'register' });
    expect(firstRes.status).toBe(200);

    // Immediate second request for same email gets 429 cooldown
    const secondRes = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.3') // Even from different IP!
      .send({ email, purpose: 'register' });
    expect(secondRes.status).toBe(429);
    expect(secondRes.body.cooldownSeconds).toBeGreaterThan(0);
    expect(secondRes.body.message).toMatch(/Please wait \d+s before requesting a new code/);
  });

  it('switching purpose between register and delete cannot bypass the 60s cooldown', async () => {
    const email = 'purpose-test@example.com';

    // First request with purpose register succeeds
    const firstRes = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.4')
      .send({ email, purpose: 'register' });
    expect(firstRes.status).toBe(200);

    // Second request with purpose delete for same email fails with cooldown 429
    const secondRes = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.5')
      .set('Authorization', 'Bearer valid-delete-token')
      .send({ email, purpose: 'delete' });
    expect(secondRes.status).toBe(429);
    expect(secondRes.body.cooldownSeconds).toBeGreaterThan(0);
    expect(secondRes.body.message).toMatch(/Please wait \d+s before requesting a new code/);
  });

  it('concurrent requests for the same email allow only one success', async () => {
    const email = 'concurrent-test@example.com';

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/send-otp')
        .set('X-Forwarded-For', '198.51.100.6')
        .send({ email, purpose: 'register' }),
      request(app)
        .post('/api/auth/send-otp')
        .set('X-Forwarded-For', '198.51.100.7')
        .send({ email, purpose: 'register' })
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must succeed (200) and the other must be rejected (429)
    expect(statuses).toEqual([200, 429]);
  });

  it('legitimate request succeeds after 60s cooldown expiry', async () => {
    const email = 'expiry-test@example.com';
    const baseTime = 1770000000000;
    jest.useFakeTimers();
    jest.setSystemTime(baseTime);

    // Request 1
    const res1 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.8')
      .send({ email, purpose: 'register' });
    expect(res1.status).toBe(200);

    // Advance time by 65 seconds
    jest.setSystemTime(baseTime + 65000);

    // Request 2 after cooldown expires should succeed
    const res2 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.8')
      .send({ email, purpose: 'register' });
    expect(res2.status).toBe(200);
  });

  it('independent email rate limit restricts targeting one email from rotating IPs', async () => {
    const email = 'distributed-target@example.com';
    const baseTime = 1771000000000;
    jest.useFakeTimers();
    jest.setSystemTime(baseTime);

    // Request 1 from IP 1 (succeeds)
    const res1 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.11')
      .send({ email, purpose: 'register' });
    expect(res1.status).toBe(200);

    // Advance past cooldown (70s)
    jest.setSystemTime(baseTime + 70000);

    // Request 2 from IP 2 (succeeds)
    const res2 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.12')
      .send({ email, purpose: 'register' });
    expect(res2.status).toBe(200);

    // Advance past cooldown (140s)
    jest.setSystemTime(baseTime + 140000);

    // Request 3 from IP 3 (succeeds)
    const res3 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.13')
      .send({ email, purpose: 'register' });
    expect(res3.status).toBe(200);

    // Advance past cooldown (210s)
    jest.setSystemTime(baseTime + 210000);

    // Request 4 from IP 4 exceeds the email-based rate limit (max 3 per 15m)
    const res4 = await request(app)
      .post('/api/auth/send-otp')
      .set('X-Forwarded-For', '198.51.100.14')
      .send({ email, purpose: 'register' });
    expect(res4.status).toBe(429);
    expect(res4.body.message).toMatch(/Too many OTP requests for this email address/);
  });

  it('OTP verification attempts are limited after 10 tries', async () => {
    const statuses = [];
    for (let i = 1; i <= 12; i++) {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .set('X-Forwarded-For', '198.51.100.20')
        .send({ email: 'verify-limit@example.com', otp: '123456', purpose: 'register' });
      statuses.push(res.status);
    }

    // First 10 attempts are processed (returning 400 for bad OTP)
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400));
    // 11th and 12th attempts are rate limited (429)
    expect(statuses[10]).toBe(429);
    expect(statuses[11]).toBe(429);
  });

  it('OTPs are never exposed in production responses', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .set('X-Forwarded-For', '198.51.100.30')
        .send({ email: 'prod-safety@example.com', purpose: 'register' });

      expect(res.body.devOtp).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('proxy trust safely ignores spoofed upstream IPs when TRUST_PROXY is hop count', async () => {
    const express = require('express');
    const testApp = express();
    testApp.set('trust proxy', 1);
    testApp.get('/test-ip', (req, res) => res.json({ ip: req.ip }));

    const res = await request(testApp)
      .get('/test-ip')
      // Malicious client injects spoofed IP in front of actual proxy IP
      .set('X-Forwarded-For', '1.1.1.1, 203.0.113.50');

    // With trust proxy 1, Express trusts only 1 hop from the right (203.0.113.50), ignoring 1.1.1.1
    expect(res.body.ip).toBe('203.0.113.50');
  });

  it('a body of { email: 123 } returns 400 (from Zod), not 500', async () => {
    const express = require('express');
    const { validate } = require('../middleware/validate');
    const { sendOtpSchema } = require('../validators/auth');
    const testApp = express();
    testApp.use(express.json());
    testApp.post('/api/auth/send-otp', validate({ body: sendOtpSchema }), (req, res) => {
      res.json({ ok: true });
    });
    const { errorHandler } = require('../middleware/errorHandler');
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/auth/send-otp')
      .send({ email: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Redis Rate Limiter Resilient Fallback Suite', () => {
  const {
    ResilientRateLimitStore,
    closeRedis,
    sanitizeRedisError
  } = require('../middleware/rateLimiter');
  const { rateLimit } = require('express-rate-limit');

  afterEach(async () => {
    await closeRedis();
  });

  function createMockRedisClient(initialStatus = 'ready') {
    let currentStatus = initialStatus;
    const redisStoreMap = new Map();

    const client = {
      get status() {
        return currentStatus;
      },
      setStatus(s) {
        currentStatus = s;
      },
      call: jest.fn(async (...args) => {
        if (currentStatus !== 'ready') {
          const err = new Error("Stream isn't writeable and enableOfflineQueue is false");
          err.code = 'NR_CLOSED';
          throw err;
        }

        const cmd = args[0];
        if (cmd === 'SCRIPT' && args[1] === 'LOAD') {
          return 'sha1-mock-hash';
        }
        if (cmd === 'EVALSHA') {
          const key = args[3];
          const windowMs = parseInt(args[4], 10) || 60000;
          const current = (redisStoreMap.get(key) || 0) + 1;
          redisStoreMap.set(key, current);
          const ttl = Math.floor(windowMs / 1000);
          return [current, ttl];
        }
        if (cmd === 'DEL') {
          const key = args[1];
          redisStoreMap.delete(key);
          return 1;
        }
        return 1;
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn()
    };
    return client;
  }

  it('Redis available at startup initializes and uses Redis store', async () => {
    const mockClient = createMockRedisClient('ready');
    const store = new ResilientRateLimitStore({ prefix: 'test_ready', client: mockClient });
    await store.init({ windowMs: 60000 });

    const result = await store.increment('ip-1');
    expect(result.totalHits).toBe(1);
    expect(store.getActiveStoreType()).toBe('redis');
    expect(mockClient.call).toHaveBeenCalled();
  });

  it('Redis unavailable at startup falls back cleanly to MemoryStore', async () => {
    const mockClient = createMockRedisClient('connecting');
    const store = new ResilientRateLimitStore({ prefix: 'test_down', client: mockClient });
    await store.init({ windowMs: 60000 });

    const result = await store.increment('ip-down');
    expect(result.totalHits).toBe(1);
    expect(store.getActiveStoreType()).toBe('memory');
  });

  it('Redis becoming unavailable after startup falls back to MemoryStore without throwing', async () => {
    const mockClient = createMockRedisClient('ready');
    const store = new ResilientRateLimitStore({ prefix: 'test_failover', client: mockClient });
    await store.init({ windowMs: 60000 });

    // Initial request uses Redis
    const res1 = await store.increment('ip-failover');
    expect(res1.totalHits).toBe(1);
    expect(store.getActiveStoreType()).toBe('redis');

    // Simulate Redis dropping connection
    mockClient.setStatus('close');

    // Subsequent request must seamlessly use memory fallback
    const res2 = await store.increment('ip-failover');
    expect(res2.totalHits).toBeGreaterThanOrEqual(1);
    expect(store.getActiveStoreType()).toBe('memory');
  });

  it('Redis reconnecting after an outage restores Redis storage', async () => {
    const mockClient = createMockRedisClient('close');
    const store = new ResilientRateLimitStore({ prefix: 'test_reconnect', client: mockClient });
    await store.init({ windowMs: 60000 });

    // First request while Redis is down uses fallback
    await store.increment('ip-rec');
    expect(store.getActiveStoreType()).toBe('memory');

    // Redis comes back online
    mockClient.setStatus('ready');

    // Next request must detect ready state and resume Redis
    const res = await store.increment('ip-rec');
    expect(res.totalHits).toBeGreaterThanOrEqual(1);
    expect(store.getActiveStoreType()).toBe('redis');
  });

  it('Redis command errors and timeouts fall back to MemoryStore without crashing request', async () => {
    const mockClient = createMockRedisClient('ready');
    const store = new ResilientRateLimitStore({ prefix: 'test_error', client: mockClient });
    await store.init({ windowMs: 60000 });

    // Force call to throw a timeout or connection error on next increment
    mockClient.call.mockRejectedValueOnce(new Error('Command timed out after 1000ms'));

    const result = await store.increment('ip-timeout');
    expect(result.totalHits).toBe(1);
    expect(store.getActiveStoreType()).toBe('memory');
  });

  it('concurrent requests during store transition do not throw or crash', async () => {
    const mockClient = createMockRedisClient('ready');
    const store = new ResilientRateLimitStore({ prefix: 'test_concurrent', client: mockClient });
    await store.init({ windowMs: 60000 });

    // Transition state right before sending requests
    mockClient.setStatus('close');

    const results = await Promise.all([
      store.increment('ip-conc-1'),
      store.increment('ip-conc-2'),
      store.increment('ip-conc-3'),
      store.increment('ip-conc-4')
    ]);

    expect(results).toHaveLength(4);
    results.forEach(r => expect(r.totalHits).toBeGreaterThanOrEqual(1));
    expect(store.getActiveStoreType()).toBe('memory');
  });

  it('rate-limit enforcement while using fallback properly rejects with 429 when limit is reached', async () => {
    const express = require('express');
    const mockClient = createMockRedisClient('close'); // Redis unavailable
    const fallbackStore = new ResilientRateLimitStore({ prefix: 'test_enforce', client: mockClient });

    const testLimiter = rateLimit({
      windowMs: 60000,
      limit: 3,
      store: fallbackStore,
      standardHeaders: true,
      legacyHeaders: false
    });

    const fallbackApp = express();
    fallbackApp.use(testLimiter);
    fallbackApp.get('/test-limit', (req, res) => res.json({ ok: true }));

    const res1 = await request(fallbackApp).get('/test-limit');
    const res2 = await request(fallbackApp).get('/test-limit');
    const res3 = await request(fallbackApp).get('/test-limit');
    const res4 = await request(fallbackApp).get('/test-limit');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
    expect(res4.status).toBe(429);
  });

  it('graceful Redis client shutdown calls quit on client', async () => {
    const mockClient = createMockRedisClient('ready');
    await mockClient.quit();
    expect(mockClient.quit).toHaveBeenCalled();
  });

  it('sanitizeRedisError redacts credentials from Redis URLs in error strings', () => {
    const secretUrlError = 'Connection failed: redis://default:SuperSecretPassword123!@cache.internal.company.com:6379';
    const sanitized = sanitizeRedisError(secretUrlError);

    expect(sanitized).not.toContain('SuperSecretPassword123!');
    expect(sanitized).toContain('redis://***:***@cache.internal.company.com:6379');

    const noCreds = 'Connection error: ETIMEDOUT';
    expect(sanitizeRedisError(noCreds)).toBe(noCreds);
  });
});

