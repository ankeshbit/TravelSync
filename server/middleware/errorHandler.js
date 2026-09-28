const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Custom AppError class for consistent operational error handling
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch unhandled promise rejections and forward to next()
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handling middleware
 * Should be the LAST middleware registered in the Express app
 */
const errorHandler = (err, req, res, _next) => {
  const isProduction = config.isProduction || process.env.NODE_ENV === 'production';

  // Request ID extraction or generation
  const requestId = req.id || req.headers?.['x-request-id'] || crypto.randomUUID();

  // User and request info for logging
  const userId = req.userId || req.user?.id || req.user?._id || 'anonymous';
  const method = req.method || 'UNKNOWN';
  const path = req.originalUrl || req.url || 'UNKNOWN';

  // Default error values
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // ─── Prisma Error Mapping ──────────────────────────────────────────────────
  // P2002: Unique constraint failed
  if (err.code === 'P2002') {
    statusCode = 409;
    code = 'P2002';
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
    message = isProduction
      ? 'A record with this identifier already exists.'
      : `Unique constraint failed${target ? ` on field(s): ${target}` : ''}.`;
  }
  // P2025: Record not found
  else if (err.code === 'P2025') {
    statusCode = 404;
    code = 'P2025';
    message = isProduction
      ? 'Requested record not found.'
      : (err.meta?.cause || err.message || 'Requested record not found.');
  }
  // P2003: Foreign key constraint failed
  else if (err.code === 'P2003') {
    statusCode = 400;
    code = 'P2003';
    message = isProduction
      ? 'Invalid reference or related record does not exist.'
      : `Foreign key constraint failed${err.meta?.field_name ? ` on field: ${err.meta.field_name}` : ''}.`;
  }
  // P2024: Connection pool timeout
  else if (err.code === 'P2024') {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Database connection timed out.';
  }
  // P1001, P1002, P1017: Database unreachable
  else if (['P1001', 'P1002', 'P1017'].includes(err.code)) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Database service is currently unreachable.';
  }
  // PrismaClientValidationError: Invalid payload / schema mismatch
  else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = isProduction
      ? 'Invalid request payload or query parameters.'
      : err.message;
  }
  // PrismaClientInitializationError: Connection or DB startup failed
  else if (err.name === 'PrismaClientInitializationError') {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = isProduction
      ? 'Database service is temporarily unavailable.'
      : err.message;
  }
  // Any other Prisma error in production: never leak raw Prisma queries or internals
  else if (err.name && err.name.startsWith('PrismaClient')) {
    if (isProduction) {
      statusCode = statusCode === 500 ? 500 : statusCode;
      code = 'DATABASE_ERROR';
      message = 'A database error occurred.';
    }
  }
  // JSON parse errors (body-parser SyntaxError)
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body.';
  }
  // Payload too large
  else if (err.type === 'entity.too.large' || statusCode === 413) {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds allowable limit.';
  }
  // Multer errors (LIMIT_FILE_SIZE, etc.)
  else if (err.name === 'MulterError') {
    statusCode = 400;
    code = err.code || 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds the maximum allowed size (5MB).'
      : (err.message || 'File upload failed.');
  }
  // CORS rejection
  else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    code = 'CORS_ERROR';
    message = 'Not allowed by CORS';
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid or malformed token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }
  // Catch generic 500 in production to prevent leaking sensitive internals
  else if (isProduction && statusCode === 500) {
    message = 'Internal server error';
  }

  // Log error with requestId, method, path, and userId
  logger.error(`[${requestId}] ${method} ${path} - User: ${userId} - ${statusCode} ${code}: ${err.message}`, {
    requestId,
    method,
    path,
    userId,
    statusCode,
    code,
    ...(err.stack && !isProduction ? { stack: err.stack } : {})
  });

  // Ensure response header carries request ID
  res.setHeader('X-Request-Id', requestId);

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    code,
    requestId,
    'request-id': requestId,
    ...(!isProduction && { stack: err.stack })
  });
};

module.exports = { errorHandler, AppError, asyncHandler };
