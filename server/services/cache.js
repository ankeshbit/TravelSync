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
      // Use SCAN in batches of 100
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
 *
 * @param {string} tripId
 * @param {string[]} memberUserIds - Owner and all members of the trip
 */
async function invalidateTrip(tripId, memberUserIds = []) {
  if (!tripId) return;

  const promises = [];
  // Invalidate any cached trip view for this tripId
  promises.push(delPattern(`${PREFIX}:trip:${tripId}:*`));
  // Invalidate AI suggestions cached for this tripId
  promises.push(delPattern(`${PREFIX}:ai:plan:${tripId}:*`));

  // Invalidate dashboard summaries for all affected users
  if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
    const uniqueUserIds = Array.from(new Set(memberUserIds.filter(Boolean)));
    uniqueUserIds.forEach((uid) => {
      promises.push(del(keys.dashboard(uid)));
      promises.push(delPattern(`${PREFIX}:explore:${uid}:*`));
    });
  }

  await Promise.all(promises);
}

/**
 * Invalidate explore caches for a specific user, or all explore caches if no user is provided.
 *
 * @param {string} [userId]
 */
async function invalidateExplore(userId) {
  if (userId) {
    await delPattern(`${PREFIX}:explore:${userId}:*`);
  } else {
    await delPattern(`${PREFIX}:explore:*`);
  }
}

/**
 * Custom client setter for unit testing and dependency injection.
 *
 * @param {any} client
 */
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
