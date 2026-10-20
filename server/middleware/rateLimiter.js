const { rateLimit, ipKeyGenerator, MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const logger = require('../utils/logger');
const {
  getRedisClient,
  isRedisReady,
  getRedisStatus,
  closeRedis,
  sanitizeRedisError
} = require('../config/redis');

/**
 * Resilient Rate Limiter Store
 *
 * Implements the express-rate-limit Store interface.
 * Delegates to RedisStore when Redis is connected and healthy ('ready').
 * Automatically and seamlessly falls back to process-local MemoryStore when
 * Redis is unavailable, disconnected, timed out, or returning errors.
 *
 * NOTE ON FALLBACK BEHAVIOR:
 * In-memory fallback counters are process-local and do NOT provide a global,
 * synchronized limit across multiple server instances during a Redis outage.
 * When Redis recovers, the store automatically resumes Redis-backed global limiting.
 * MemoryStore counters are preserved across transitions to prevent silent reset abuse.
 */
class ResilientRateLimitStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl';
    this.memoryStore = new MemoryStore();
    this.options = null;
    this.redisStore = null;
    this.activeStoreType = 'memory';
    this.redisInitPromise = null;
    this.redisStoreInitialized = false;

    // Custom client override (useful for dependency injection and testing)
    this.customClient = options.client || null;

    this._setupRedisStore();
  }

  _getClient() {
    return this.customClient || getRedisClient();
  }

  _setupRedisStore() {
    const client = this._getClient();
    if (client) {
      this.redisStore = new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix: `ts_rl:${this.prefix}:`
      });
    }
  }

  isRedisReady() {
    const client = this._getClient();
    return !!(client && client.status === 'ready');
  }

  getActiveStoreType() {
    return this.activeStoreType;
  }

  async init(options) {
    this.options = options;
    if (this.memoryStore && typeof this.memoryStore.init === 'function') {
      await this.memoryStore.init(options);
    }
    if (this.isRedisReady()) {
      await this._ensureRedisStoreInitialized();
    }
  }

  async _ensureRedisStoreInitialized() {
    if (!this.redisStore || !this.options) {
      return false;
    }
    if (this.redisStoreInitialized) {
      return true;
    }
    if (this.redisInitPromise) {
      return this.redisInitPromise;
    }

    this.redisInitPromise = (async () => {
      try {
        await this.redisStore.init(this.options);
        this.redisStoreInitialized = true;
        return true;
      } catch (err) {
        this.redisStoreInitialized = false;
        logger.warn(
          { prefix: this.prefix, err: sanitizeRedisError(err.message) },
          '[RateLimit] Failed to initialize RedisStore scripts'
        );
        return false;
      } finally {
        this.redisInitPromise = null;
      }
    })();

    return this.redisInitPromise;
  }

  async get(key) {
    if (this.isRedisReady()) {
      const ready = await this._ensureRedisStoreInitialized();
      if (ready) {
        try {
          const res = await this.redisStore.get(key);
          this._markActiveStore('redis');
          return res;
        } catch (err) {
          this._handleRedisFailure(err);
        }
      }
    }
    this._markActiveStore('memory');
    return this.memoryStore.get(key);
  }

  async increment(key) {
    if (this.isRedisReady()) {
      const ready = await this._ensureRedisStoreInitialized();
      if (ready) {
        try {
          const res = await this.redisStore.increment(key);
          this._markActiveStore('redis');
          return res;
        } catch (err) {
          this._handleRedisFailure(err);
        }
      }
    }
    this._markActiveStore('memory');
    return this.memoryStore.increment(key);
  }

  async decrement(key) {
    if (this.isRedisReady()) {
      const ready = await this._ensureRedisStoreInitialized();
      if (ready) {
        try {
          await this.redisStore.decrement(key);
          this._markActiveStore('redis');
          return;
        } catch (err) {
          this._handleRedisFailure(err);
        }
      }
    }
    this._markActiveStore('memory');
    if (typeof this.memoryStore.decrement === 'function') {
      await this.memoryStore.decrement(key);
    }
  }

  async resetKey(key) {
    const promises = [];
    if (this.memoryStore && typeof this.memoryStore.resetKey === 'function') {
      promises.push(this.memoryStore.resetKey(key));
    }
    if (this.isRedisReady() && this.redisStore) {
      promises.push(
        this.redisStore.resetKey(key).catch((err) => {
          this._handleRedisFailure(err);
        })
      );
    }
    await Promise.all(promises);
  }

  async resetAll() {
    if (this.memoryStore && typeof this.memoryStore.resetAll === 'function') {
      await this.memoryStore.resetAll();
    }
    this.redisStoreInitialized = false;
  }

  _markActiveStore(type) {
    if (this.activeStoreType !== type) {
      this.activeStoreType = type;
      if (type === 'redis') {
        logger.info({ prefix: this.prefix }, '[RateLimit] Resuming Redis rate-limit store');
      } else {
        logger.warn(
          { prefix: this.prefix },
          '[RateLimit] Active store switched to in-memory fallback'
        );
      }
    }
  }

  _handleRedisFailure(err) {
    this.redisStoreInitialized = false;
    this._markActiveStore('memory');
    logger.warn(
      { prefix: this.prefix, err: sanitizeRedisError(err?.message), code: err?.code },
      '[RateLimit] Redis command failure; falling back to in-memory store'
    );
  }
}

function createLimiterStore(prefix, options = {}) {
  return new ResilientRateLimitStore({ prefix, ...options });
}

/**
 * Middleware to resolve the normalized target email address for OTP endpoints
 * before rate limiters and validation run.
 */
async function resolveOtpTargetEmail(req, res, next) {
  try {
    const purpose = req.body?.purpose || 'register';
    let targetEmail = '';

    if (purpose === 'delete') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        try {
          const { verifyFirebaseToken } = require('../config/firebaseAdmin');
          const decoded = await verifyFirebaseToken(token);
          if (decoded && decoded.email) {
            targetEmail = decoded.email;
          }
        } catch {
          // Token decode error will be formally handled by the route handler
        }
      }
    }

    if (!targetEmail && typeof req.body?.email === 'string') {
      targetEmail = req.body.email;
    }

    req.targetEmail = targetEmail ? targetEmail.toLowerCase().trim() : '';
    next();
  } catch (err) {
    next(err);
  }
}

// ─── Limiters ────────────────────────────────────────────────────────────────

// General API limiter: 300 requests per 15 minutes per IP
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  store: createLimiterStore('general_api'),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    message: 'Too many requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth endpoints: 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  store: createLimiterStore('auth'),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    message: 'Too many authentication attempts, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Issuance - IP Limiter: 5 sends per 15 min per IP
const sendOtpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  store: createLimiterStore('send_otp_ip'),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    message: 'Too many OTP requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Issuance - Email Limiter: 3 sends per 15 min per normalized email
const sendOtpEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  store: createLimiterStore('send_otp_email'),
  keyGenerator: (req) => (req.targetEmail ? req.targetEmail.toLowerCase().trim() : 'anonymous'),
  skip: (req) => !req.targetEmail,
  message: {
    message: 'Too many OTP requests for this email address, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Verification - IP Limiter: 10 attempts per 15 min per IP
const verifyOtpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: createLimiterStore('verify_otp_ip'),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    message: 'Too many OTP verification attempts from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Verification - Email Limiter: 10 attempts per 15 min per normalized email
const verifyOtpEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: createLimiterStore('verify_otp_email'),
  keyGenerator: (req) => (req.targetEmail ? req.targetEmail.toLowerCase().trim() : 'anonymous'),
  skip: (req) => !req.targetEmail,
  message: {
    message: 'Too many OTP verification attempts for this email address, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});



module.exports = {
  generalApiLimiter,
  authLimiter,
  sendOtpIpLimiter,
  sendOtpEmailLimiter,
  verifyOtpIpLimiter,
  verifyOtpEmailLimiter,
  resolveOtpTargetEmail,
  closeRedis,
  ResilientRateLimitStore,
  getRedisClient,
  isRedisReady,
  getRedisStatus,
  createLimiterStore,
  sanitizeRedisError
};
