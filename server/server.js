require('dotenv').config();
const config = require('./config/env');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { errorHandler } = require('./middleware/errorHandler');
const http = require('http');
const { prisma } = require('./db');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// ─── Trust Proxy ─────────────────────────────────────────────────────────────
if (config.TRUST_PROXY !== false) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,          // Don't block cross-origin images in dev
  crossOriginResourcePolicy: false       // Allow images to be loaded cross-origin
}));

// ─── CORS Configuration ──────────────────────────────────────────────────────
const allowedOrigins = (config.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  // Allow non-browser requests (tools, postman, curl, server-to-server)
  if (!origin) return true;

  // Allow localhost origins ONLY when NODE_ENV !== 'production'
  if (!config.isProduction) {
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return true;
    }
  }

  // In production, allow ONLY ALLOWED_ORIGIN (supporting comma-separated list)
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
};
app.use(cors(corsOptions));
const crypto = require('crypto');
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ─── Request ID Middleware ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// ─── Static Uploads ───────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ─── Socket.IO Setup ─────────────────────────────────────────────────────────
const { setupSocket } = require('./socket');
const io = setupSocket(server, corsOptions);

// Attach io to req for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// General API limiter: 300 requests per 15 minutes per IP for all /api endpoints
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: {
    message: 'Too many requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', generalApiLimiter);

// Strict OTP limiter: 5 requests per 15 minutes per IP for send/verify OTP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: {
    message: 'Too many OTP requests, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/send-otp', otpLimiter);
app.use('/api/auth/verify-otp', otpLimiter);

// Auth endpoints: 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: {
    message: 'Too many authentication attempts, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Neon PostgreSQL Connection with Backoff ─────────────────────────────────
async function connectWithRetry(retries = 5, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('✓ Neon PostgreSQL connected successfully');
      return;
    } catch (err) {
      logger.error({ err }, `✗ Neon PostgreSQL connection attempt ${attempt}/${retries} failed`);
      if (attempt < retries) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        logger.info(`Retrying DB connection in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        if (config.isProduction) {
          logger.error('Fatal: Exhausted database connection retries in production.');
          process.exit(1);
        } else {
          logger.warn('⚠ Starting without a database connection. API routes that need Neon DB will fail until DATABASE_URL is configured.');
        }
      }
    }
  }
}

const { cleanupExpiredOtps } = require('./utils/otpStore');

if (config.DATABASE_URL && !config.isTest) {
  connectWithRetry();
} else if (!config.isTest) {
  logger.warn('⚠ DATABASE_URL is not configured. Starting the API without a database connection.');
}


// ─── Scheduled Expired OTP Cleanup Job ───────────────────────────────────────
if (!config.isTest) {
  setTimeout(() => cleanupExpiredOtps().catch(() => {}), 5000).unref();
  setInterval(() => cleanupExpiredOtps().catch(() => {}), 15 * 60 * 1000).unref();
}

// ─── Health Checks ───────────────────────────────────────────────────────────
// Liveness probe (always cheap)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  if (config.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    message: isHealthy ? 'TravelSync server is running' : 'Database disconnected or unavailable',
    timestamp: new Date(),
    database: 'PostgreSQL (Neon)',
    dbStatus
  });
});

// Readiness probe
app.get('/api/health/ready', async (req, res) => {
  try {
    if (!config.DATABASE_URL) {
      return res.status(503).json({
        status: 'not ready',
        database: 'not configured',
        timestamp: new Date()
      });
    }
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date()
    });
  } catch (err) {
    return res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date()
    });
  }
});

// ─── Public App Statistics ───────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [users, trips] = await Promise.all([
      prisma.user.count(),
      prisma.trip.count()
    ]);
    res.json({ users, trips });
  } catch (err) {
    logger.error({ err }, 'Error fetching stats');
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// ─── Swagger Documentation ──────────────────────────────────────────────────
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/explore', require('./routes/explore'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND'
  });
});

// ─── Global Error Handler (MUST BE LAST) ─────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = config.PORT;
  server.listen(PORT, () => {
    logger.info(`✓ Server running on http://localhost:${PORT}`);
    logger.info(`✓ CORS allowed origins: ${config.isProduction ? allowedOrigins.join(', ') : allowedOrigins.join(', ') + ' (+ localhost in dev)'}`);
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let isShuttingDown = false;
const gracefulShutdown = (signalOrCode = 'SIGTERM') => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signalOrCode}. Shutting down gracefully...`);

  // Force exit after 10s timeout
  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(typeof signalOrCode === 'number' ? signalOrCode : 1);
  }, 10000);
  forceTimer.unref();

  if (io) {
    try {
      io.close();
      logger.info('Socket.IO closed');
    } catch (e) {
      logger.error({ err: e }, 'Error closing Socket.IO');
    }
  }

  server.close(async () => {
    logger.info('Closed out remaining HTTP connections');
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (e) {
      logger.error({ err: e }, 'Error disconnecting database');
    }
    clearTimeout(forceTimer);
    process.exit(typeof signalOrCode === 'number' ? signalOrCode : 0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
  gracefulShutdown(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  gracefulShutdown(1);
});

module.exports = app;
