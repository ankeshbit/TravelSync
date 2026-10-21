const { getRedisClient, isRedisReady, sanitizeRedisError } = require('../config/redis');
const logger = require('../utils/logger');

// Cache prefix namespace
const PREFIX = 'ts';

// Standard TTLs in seconds
const TTLS = {
  DASHBOARD: 300,        // 5 minutes
  TRIP_DETAIL: 600,      // 10 minutes
  EXPLORE: 900,          // 15 minutes
  AI_SUGGESTIONS: 3600   // 1 hour
};

let customClient = null;

function getClient() {
  return customClient || getRedisClient();
}

function isReady() {
  if (customClient) {
    return customClient.status === 'ready';
  }
  return isRedisReady();
}

/**
 * Key builders ensuring consistent tenant and user scoping.
 */
const keys = {
  dashboard: (userId) => `${PREFIX}:dashboard:${userId}`,
  trip: (tripId, userId) => `${PREFIX}:trip:${tripId}:${userId}`,
  explore: (userId, query = '') => {
    const q = (query || '').trim().toLowerCase();
    return `${PREFIX}:explore:${userId}:${q || 'all'}`;
  },
  aiSuggestions: (tripId, hash) => `${PREFIX}:ai:plan:${tripId}:${hash}`
};

function getIndexKey(key) {
  const tripMatch = key.match(/^ts:trip:([^:]+):/);
  if (tripMatch) {
    return `${PREFIX}:idx:trip:${tripMatch[1]}`;
  }
  const aiMatch = key.match(/^ts:ai:plan:([^:]+):/);
  if (aiMatch) {
    return `${PREFIX}:idx:trip:${aiMatch[1]}`;
  }
  const exploreMatch = key.match(/^ts:explore:([^:]+):/);
  if (exploreMatch) {
    return `${PREFIX}:idx:explore:${exploreMatch[1]}`;
  }
  return null;
}

/**
 * Retrieve cached object by key.
 * Returns parsed object on hit, null on miss or error.
 * Never throws to caller.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {
  try {
    if (!isReady()) return null;
    const client = getClient();
    if (!client) return null;

    const raw = await client.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      logger.warn({ key, err: parseErr.message }, '[Cache] Malformed JSON in cache, deleting key');
      client.del(key).catch(() => {});
      return null;
    }
  } catch (err) {
    logger.warn({ key, err: sanitizeRedisError(err.message) }, '[Cache] Get failed');
    return null;
  }
}

/**
 * Set an object in cache with an explicit TTL.
 * Tracks trip, AI, and explore keys in Redis sets for targeted invalidation without SCAN.
 * Never throws to caller.
 *
 * @param {string} key
 * @param {any} data
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
async function set(key, data, ttlSeconds = 300) {
  try {
    if (!isReady() || data === undefined || data === null) return false;
    const client = getClient();
    if (!client) return false;

    const serialized = JSON.stringify(data);
    await client.set(key, serialized, 'EX', ttlSeconds);

    const idxKey = getIndexKey(key);
    if (idxKey) {
      const idxTtl = ttlSeconds + 60; // Same TTL plus small buffer
      if (typeof client.pipeline === 'function') {
        const p = client.pipeline();
        if (typeof p.sadd === 'function') p.sadd(idxKey, key);
        if (typeof p.expire === 'function') p.expire(idxKey, idxTtl);
        if (idxKey.startsWith(`${PREFIX}:idx:explore:`) && typeof p.sadd === 'function') {
          p.sadd(`${PREFIX}:idx:explore:users`, idxKey);
          if (typeof p.expire === 'function') p.expire(`${PREFIX}:idx:explore:users`, idxTtl);
        }
        await p.exec();
      } else {
        if (typeof client.sadd === 'function') {
          await client.sadd(idxKey, key);
          if (typeof client.expire === 'function') {
            await client.expire(idxKey, idxTtl);
          }
          if (idxKey.startsWith(`${PREFIX}:idx:explore:`)) {
            await client.sadd(`${PREFIX}:idx:explore:users`, idxKey);
            if (typeof client.expire === 'function') {
              await client.expire(`${PREFIX}:idx:explore:users`, idxTtl);
            }
          }
        }
      }
    }

    return true;
  } catch (err) {
    logger.warn({ key, err: sanitizeRedisError(err.message) }, '[Cache] Set failed');
    return false;
  }
}

/**
 * Delete a single cache key.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function del(key) {
  try {
    if (!isReady()) return false;
    const client = getClient();
    if (!client) return false;

    await client.del(key);
    return true;
  } catch (err) {
    logger.warn({ key, err: sanitizeRedisError(err.message) }, '[Cache] Del failed');
    return false;
  }
}

/**
 * Delete keys matching a pattern using SCAN to avoid blocking Redis.
 *
 * @param {string} pattern
 * @returns {Promise<number>} Number of keys removed
 */
async function delPattern(pattern) {
  try {
    if (!isReady()) return 0;
    const client = getClient();
    if (!client) return 0;

    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, matchedKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (matchedKeys && matchedKeys.length > 0) {
        await client.del(...matchedKeys);
        totalDeleted += matchedKeys.length;
      }
    } while (cursor !== '0');

    return totalDeleted;
  } catch (err) {
    logger.warn({ pattern, err: sanitizeRedisError(err.message) }, '[Cache] DelPattern failed');
    return 0;
  }
}

/**
 * Invalidate user dashboard cache for a user or multiple users.
 *
 * @param {string|string[]} userIds
 */
async function invalidateUserDashboard(userIds) {
  if (!userIds) return;
  const list = Array.isArray(userIds) ? userIds : [userIds];
  const promises = list.filter(Boolean).map(uid => del(keys.dashboard(uid)));
  await Promise.all(promises);
}

/**
 * Invalidate trip detail and member dashboard caches following a trip or expense mutation.
 * Uses index sets (ts:idx:trip:{tripId}) without scanning keyspace.
 *
 * @param {string} tripId
 * @param {string[]} memberUserIds - Owner and all members of the trip
 */
async function invalidateTrip(tripId, memberUserIds = []) {
  if (!tripId) return;

  try {
    if (!isReady()) return;
    const client = getClient();
    if (!client) return;

    const idxKey = `${PREFIX}:idx:trip:${tripId}`;
    let tripKeys = [];
    if (typeof client.smembers === 'function') {
      tripKeys = await client.smembers(idxKey) || [];
    }

    const keysToDelete = new Set(Array.isArray(tripKeys) ? tripKeys : []);
    keysToDelete.add(idxKey);

    // Dashboard keys for members
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      const uniqueUserIds = Array.from(new Set(memberUserIds.filter(Boolean)));
      for (const uid of uniqueUserIds) {
        keysToDelete.add(keys.dashboard(uid));
      }
    }

    const keyArray = Array.from(keysToDelete).filter(Boolean);
    if (keyArray.length > 0) {
      if (typeof client.pipeline === 'function') {
        const p = client.pipeline();
        keyArray.forEach(k => {
          if (typeof p.del === 'function') p.del(k);
        });
        await p.exec();
      } else {
        await client.del(...keyArray);
      }
    }

    // Invalidate explore for members
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      const uniqueUserIds = Array.from(new Set(memberUserIds.filter(Boolean)));
      for (const uid of uniqueUserIds) {
        await invalidateExplore(uid);
      }
    }
  } catch (err) {
    logger.warn({ tripId, err: sanitizeRedisError(err.message) }, '[Cache] InvalidateTrip failed');
  }
}

/**
 * Invalidate explore caches for a specific user, or all explore caches if no user is provided.
 * Uses index sets without scanning keyspace.
 *
 * @param {string} [userId]
 */
async function invalidateExplore(userId) {
  try {
    if (!isReady()) return;
    const client = getClient();
    if (!client) return;

    if (userId) {
      const idxKey = `${PREFIX}:idx:explore:${userId}`;
      let exploreKeys = [];
      if (typeof client.smembers === 'function') {
        exploreKeys = await client.smembers(idxKey) || [];
      }
      const keysToDelete = new Set(Array.isArray(exploreKeys) ? exploreKeys : []);
      keysToDelete.add(idxKey);

      const keyArray = Array.from(keysToDelete).filter(Boolean);
      if (keyArray.length > 0) {
        if (typeof client.pipeline === 'function') {
          const p = client.pipeline();
          keyArray.forEach(k => {
            if (typeof p.del === 'function') p.del(k);
          });
          await p.exec();
        } else {
          await client.del(...keyArray);
        }
      }
    } else {
      let userIndexSets = [];
      if (typeof client.smembers === 'function') {
        userIndexSets = await client.smembers(`${PREFIX}:idx:explore:users`) || [];
      }
      const keysToDelete = new Set();
      if (Array.isArray(userIndexSets)) {
        for (const userSet of userIndexSets) {
          keysToDelete.add(userSet);
          if (typeof client.smembers === 'function') {
            const memberKeys = await client.smembers(userSet) || [];
            if (Array.isArray(memberKeys)) {
              memberKeys.forEach(k => keysToDelete.add(k));
            }
          }
        }
      }
      keysToDelete.add(`${PREFIX}:idx:explore:users`);

      const keyArray = Array.from(keysToDelete).filter(Boolean);
      if (keyArray.length > 0) {
        if (typeof client.pipeline === 'function') {
          const p = client.pipeline();
          keyArray.forEach(k => {
            if (typeof p.del === 'function') p.del(k);
          });
          await p.exec();
        } else {
          await client.del(...keyArray);
        }
      }
    }
  } catch (err) {
    logger.warn({ userId, err: sanitizeRedisError(err.message) }, '[Cache] InvalidateExplore failed');
  }
}

function _setCacheClientForTesting(client) {
  customClient = client;
}

module.exports = {
  PREFIX,
  TTLS,
  keys,
  get,
  set,
  del,
  delPattern,
  invalidateUserDashboard,
  invalidateTrip,
  invalidateExplore,
  _setCacheClientForTesting
};
