const config = require('../config/env');

const SENSITIVE_KEYS = /password|token|secret|otp|authorization|bearer|cookie/i;

function serializeError(err) {
  if (!err) return err;
  if (err instanceof Error || (typeof err === 'object' && (err.name || err.message || err.stack))) {
    const isProd = config.isProduction;
    const serialized = {
      name: err.name || 'Error',
      message: err.message || '',
      ...(err.code ? { code: err.code } : {}),
      ...(err.statusCode ? { statusCode: err.statusCode } : {}),
      ...(!isProd && err.stack ? { stack: err.stack } : {})
    };
    for (const [key, value] of Object.entries(err)) {
      if (!['name', 'message', 'code', 'statusCode', 'stack'].includes(key)) {
        serialized[key] = value;
      }
    }
    return serialized;
  }
  return err;
}

function redact(obj, depth = 0) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (depth > 5) return '[TRUNCATED]';

  if (obj instanceof Error) {
    return redact(serializeError(obj), depth);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item, depth + 1));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key)) {
      result[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      result[key] = redact(serializeError(value), depth + 1);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeArgs(arg1, arg2) {
  let message = '';
  let meta = {};

  if (typeof arg1 === 'string') {
    message = arg1;
    if (arg2 && typeof arg2 === 'object') {
      meta = arg2;
    }
  } else if (arg1 && typeof arg1 === 'object') {
    meta = arg1;
    if (typeof arg2 === 'string') {
      message = arg2;
    } else if (arg1 instanceof Error) {
      message = arg1.message;
    } else if (typeof arg1.message === 'string') {
      message = arg1.message;
    }
  } else if (arg1 !== undefined && arg1 !== null) {
    message = String(arg1);
    if (arg2 && typeof arg2 === 'object') {
      meta = arg2;
    }
  }

  return { message, meta };
}

function formatLog(level, arg1, arg2) {
  const { message, meta } = normalizeArgs(arg1, arg2);
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
  info: (arg1, arg2) => {
    /* eslint-disable no-console */
    console.log(formatLog('info', arg1, arg2));
    /* eslint-enable no-console */
  },
  warn: (arg1, arg2) => {
    /* eslint-disable no-console */
    console.warn(formatLog('warn', arg1, arg2));
    /* eslint-enable no-console */
  },
  error: (arg1, arg2) => {
    /* eslint-disable no-console */
    console.error(formatLog('error', arg1, arg2));
    /* eslint-enable no-console */
  },
  debug: (arg1, arg2) => {
    if (!config.isProduction) {
      /* eslint-disable no-console */
      console.log(formatLog('debug', arg1, arg2));
      /* eslint-enable no-console */
    }
  },
  redact,
  serializeError,
  normalizeArgs,
  formatLog
};

module.exports = logger;

