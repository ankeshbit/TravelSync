const config = require('../config/env');

const SENSITIVE_KEYS = /password|token|secret|otp|authorization|bearer|cookie/i;

function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item, depth + 1));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatLog(level, message, meta = {}) {
  const isProduction = config.isProduction;
  const safeMeta = redact(meta);

  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(Object.keys(safeMeta).length > 0 ? { meta: safeMeta } : {})
    });
  }

  const metaStr = Object.keys(safeMeta).length > 0 ? ` ${JSON.stringify(safeMeta)}` : '';
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  info: (message, meta) => {
    /* eslint-disable no-console */
    console.log(formatLog('info', message, meta));
    /* eslint-enable no-console */
  },
  warn: (message, meta) => {
    /* eslint-disable no-console */
    console.warn(formatLog('warn', message, meta));
    /* eslint-enable no-console */
  },
  error: (message, meta) => {
    /* eslint-disable no-console */
    console.error(formatLog('error', message, meta));
    /* eslint-enable no-console */
  },
  debug: (message, meta) => {
    if (!config.isProduction) {
      /* eslint-disable no-console */
      console.log(formatLog('debug', message, meta));
      /* eslint-enable no-console */
    }
  },
  redact
};

module.exports = logger;
