const crypto = require('crypto');
const cache = require('../services/cache');
const config = require('../config/env');
const logger = require('./logger');

const memoryCache = new Map();
const memoryLocks = new Map();
const MAX_MEMORY_ENTRIES = 2000;

function pruneMemoryStore() {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
  for (const [key, item] of memoryLocks.entries()) {
    if (item.expiresAt && item.expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 500);
    keysToDelete.forEach(k => memoryCache.delete(k));
  }
}

// Background cleanup every 5 minutes
const cleanupTimer = setInterval(pruneMemoryStore, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function buildKey(userId, tripId, idempotencyKey) {
  return `${userId}:${tripId}:${idempotencyKey}`;
}

/**
 * Deterministically compute a SHA-256 hash of the expense request payload.
 *
 * @param {object} payload
 * @returns {string}
 */
function computePayloadHash(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const splits = Array.isArray(payload.splitAmong)
    ? payload.splitAmong
    : Array.isArray(payload.splits)
      ? payload.splits
      : [];

  const normalizedSplits = splits
    .map(s => (typeof s === 'object' && s ? (s.userId || s.id || s._id) : s))
    .filter(Boolean)
    .sort();

  const canonical = {
    title: (payload.title || '').trim(),
    amount: parseFloat(payload.amount) || 0,
    currency: (payload.currency || 'INR').trim().toUpperCase(),
    category: (payload.category || 'other').trim().toLowerCase(),
    paidBy: (payload.paidBy || '').trim(),
    splitAmong: normalizedSplits
  };

  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Retrieve cached expense by composite key.
 * Returns { data, hash } or null.
 *
 * @param {string} userId
 * @param {string} tripId
 * @param {string} idempotencyKey
 * @returns {Promise<{ data: any, hash: string|null }|null>}
 */
async function getCachedExpense(userId, tripId, idempotencyKey) {
  if (!userId || !tripId || !idempotencyKey) return null;
  const compositeKey = buildKey(userId, tripId, idempotencyKey);
  const redisKey = `ts:idemp:expense:${compositeKey}`;

  try {
    const fromRedis = await cache.get(redisKey);
    if (fromRedis) {
      if (fromRedis && typeof fromRedis === 'object' && 'data' in fromRedis && 'hash' in fromRedis) {
        return fromRedis;
      }
      return { data: fromRedis, hash: null };
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[Idempotency] Failed reading from Redis cache');
  }

  const memItem = memoryCache.get(compositeKey);
  if (memItem) {
    if (memItem.expiresAt > Date.now()) {
      return { data: memItem.data, hash: memItem.hash || null };
    }
    memoryCache.delete(compositeKey);
  }

  return null;
}

/**
 * Acquire distributed lock for expense creation.
 * Uses atomic Redis SET NX EX with a unique ownership token.
 *
 * @param {string} userId
 * @param {string} tripId
 * @param {string} idempotencyKey
 * @param {number} [ttlSeconds=10]
 * @returns {Promise<{ acquired: boolean, lockToken: string|null }>}
 */
async function acquireLock(userId, tripId, idempotencyKey, ttlSeconds = 10) {
  if (!userId || !tripId || !idempotencyKey) {
    return { acquired: true, lockToken: null };
  }
  const compositeKey = buildKey(userId, tripId, idempotencyKey);
  const redisLockKey = `ts:idemp:lock:${compositeKey}`;
  const now = Date.now();
  const lockToken = crypto.randomUUID();

  // 1. Process-local check
  const memLock = memoryLocks.get(compositeKey);
  if (memLock && memLock.expiresAt > now) {
    return { acquired: false, lockToken: null };
  }

  // 2. Atomic distributed lock via Redis SET NX EX
  const redisSetNx = await cache.setNX(redisLockKey, lockToken, ttlSeconds);
  if (redisSetNx === false) {
    return { acquired: false, lockToken: null };
  }

  // 3. If Redis is down in production with REDIS_URL configured, fail safely
  if (redisSetNx === null && config.isProduction && config.REDIS_URL) {
    logger.error({ redisLockKey }, '[Idempotency] Redis unavailable in production; rejecting to prevent duplicate charges');
    const err = new Error('Distributed lock service is temporarily unavailable. Please retry.');
    err.statusCode = 503;
    err.code = 'IDEMPOTENCY_UNAVAILABLE';
    throw err;
  }

  // 4. Lock acquired successfully
  memoryLocks.set(compositeKey, { token: lockToken, expiresAt: now + (ttlSeconds * 1000) });
  return { acquired: true, lockToken };
}

/**
 * Safely release distributed lock using ownership token.
 *
 * @param {string} userId
 * @param {string} tripId
 * @param {string} idempotencyKey
 * @param {string} [lockToken]
 * @returns {Promise<void>}
 */
async function releaseLock(userId, tripId, idempotencyKey, lockToken = null) {
  if (!userId || !tripId || !idempotencyKey) return;
  const compositeKey = buildKey(userId, tripId, idempotencyKey);
  const redisLockKey = `ts:idemp:lock:${compositeKey}`;

  const memLock = memoryLocks.get(compositeKey);
  if (memLock && (!lockToken || memLock.token === lockToken)) {
    memoryLocks.delete(compositeKey);
  }

  try {
    if (lockToken) {
      await cache.releaseLock(redisLockKey, lockToken);
    } else {
      await cache.del(redisLockKey).catch(() => {});
    }
  } catch (err) {
    logger.warn({ err: err.message }, '[Idempotency] Failed releasing Redis lock');
  }
}

/**
 * Save expense to idempotency cache alongside its payload hash.
 * Supports both signatures:
 *   saveExpense(userId, tripId, idempotencyKey, expenseData, requestHash, ttlSeconds, lockToken)
 *   saveExpense(userId, tripId, idempotencyKey, expenseData, ttlSeconds)
 *
 * @param {string} userId
 * @param {string} tripId
 * @param {string} idempotencyKey
 * @param {any} expenseData
 * @param {string|number|null} [requestHashOrTtl]
 * @param {number} [ttlSeconds=86400]
 * @param {string} [lockToken]
 */
async function saveExpense(userId, tripId, idempotencyKey, expenseData, requestHashOrTtl = null, ttlSeconds = 86400, lockToken = null) {
  if (!userId || !tripId || !idempotencyKey) return;
  const compositeKey = buildKey(userId, tripId, idempotencyKey);
  const redisKey = `ts:idemp:expense:${compositeKey}`;

  let requestHash = null;
  let ttl = ttlSeconds;
  let token = lockToken;

  if (typeof requestHashOrTtl === 'number') {
    ttl = requestHashOrTtl;
  } else if (typeof requestHashOrTtl === 'string') {
    requestHash = requestHashOrTtl;
  }

  const entry = { data: expenseData, hash: requestHash };

  try {
    await cache.set(redisKey, entry, ttl).catch(() => {});
  } catch (err) {
    logger.warn({ err: err.message }, '[Idempotency] Failed saving to Redis cache');
  }

  memoryCache.set(compositeKey, {
    data: expenseData,
    hash: requestHash,
    expiresAt: Date.now() + (ttl * 1000)
  });

  await releaseLock(userId, tripId, idempotencyKey, token);
}

function _clearForTesting() {
  memoryCache.clear();
  memoryLocks.clear();
}

module.exports = {
  computePayloadHash,
  getCachedExpense,
  acquireLock,
  releaseLock,
  saveExpense,
  _clearForTesting
};
