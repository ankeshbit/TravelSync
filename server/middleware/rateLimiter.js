const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config/env');
const logger = require('../utils/logger');

let redisClient = null;

function getRedisClient() {
  if (!config.REDIS_URL) {
    return null;
  }
  if (!redisClient) {
    try {
      redisClient = new Redis(config.REDIS_URL, {
        lazyConnect: false,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
        retryStrategy(times) {
          if (times > 5) {
            logger.warn('[RateLimit] Exceeded Redis retry attempts, falling back to memory store');
            return null;
          }
          return Math.min(times * 100, 2000);
        }
      });

      redisClient.on('error', (err) => {
        logger.warn({ err: err.message }, '[RateLimit] Redis error in rate limiter');
      });

      redisClient.on('connect', () => {
        logger.info('[RateLimit] Connected to Redis for distributed rate limiting');
      });
    } catch (err) {
      logger.warn({ err }, '[RateLimit] Failed to initialize Redis client');
      redisClient = null;
    }
  }
  return redisClient;
}

function createLimiterStore(prefix) {
  const client = getRedisClient();
  if (client) {
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `ts_rl:${prefix}:`
    });
  }
  return undefined; // MemoryStore fallback
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

async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
}

module.exports = {
  generalApiLimiter,
  authLimiter,
  sendOtpIpLimiter,
  sendOtpEmailLimiter,
  verifyOtpIpLimiter,
  verifyOtpEmailLimiter,
  resolveOtpTargetEmail,
  closeRedis
};
