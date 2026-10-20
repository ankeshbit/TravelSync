const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Sanitize error message to remove Redis credentials or connection strings.
 *
 * @param {Error|string|any} err
 * @returns {string}
 */
function sanitizeRedisError(err) {
  if (!err) return '';
  const message = typeof err === 'string' ? err : (err.message || String(err));
  return message.replace(/:\/\/[^@/\s]+@/g, '://***:***@');
}

/**
 * Get or initialize the singleton Redis client with bounded retry strategy.
 *
 * @returns {Redis|null}
 */
function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }
  if (!config.REDIS_URL || (config.isTest && !process.env.TEST_LIVE_REDIS)) {
    return null;
  }
  if (!redisClient) {
    try {
      redisClient = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        commandTimeout: 1500,
        connectTimeout: 2000,
        retryStrategy(times) {
          if (config.isTest || times > 5) {
            return null; // Prevent uncontrolled retry loops
          }
          return Math.min(times * 200, 2000);
        }
      });

      redisClient.on('error', (err) => {
        logger.warn(
          { err: sanitizeRedisError(err.message), code: err.code },
          '[Redis] Connection error'
        );
      });

      redisClient.on('connect', () => {
        logger.info('[Redis] Connected to Redis instance');
      });

      redisClient.on('ready', () => {
        logger.info('[Redis] Client ready for commands');
      });

      redisClient.on('close', () => {
        logger.info('[Redis] Connection closed');
      });

      if (!config.isTest) {
        redisClient.connect().catch(() => {});
      }
    } catch (err) {
      logger.warn(
        { err: sanitizeRedisError(err.message) },
        '[Redis] Failed to instantiate Redis client'
      );
      redisClient = null;
    }
  }
  return redisClient;
}

/**
 * Check if the Redis client is currently connected and ready.
 *
 * @returns {boolean}
 */
function isRedisReady() {
  return !!(redisClient && redisClient.status === 'ready');
}

/**
 * Return safe, non-sensitive Redis health status for diagnostics.
 *
 * @returns {{ configured: boolean, status: string }}
 */
function getRedisStatus() {
  if (redisClient) {
    return { configured: true, status: redisClient.status };
  }
  if (!config.REDIS_URL) {
    return { configured: false, status: 'not configured' };
  }
  return { configured: true, status: 'disconnected' };
}

/**
 * Safely close the Redis connection during graceful shutdown or tests.
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_err) {
      try {
        redisClient.disconnect();
      } catch (_disconnectErr) {
        // Disconnect failure during shutdown can be safely ignored
      }
    }
    redisClient = null;
  }
}

/**
 * Allow test suites or custom runners to inject or reset the client.
 *
 * @param {Redis|null} client
 */
function _setRedisClientForTesting(client) {
  redisClient = client;
}

module.exports = {
  getRedisClient,
  isRedisReady,
  getRedisStatus,
  closeRedis,
  sanitizeRedisError,
  _setRedisClientForTesting
};
