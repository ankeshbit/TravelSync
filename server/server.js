require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { errorHandler } = require('./middleware/errorHandler');
const http = require('http');
const { Server } = require('socket.io');

const isProduction = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGO_URI?.trim();

// Provide safe local defaults in development so the server can boot even when
// a fresh .env file has not been filled in yet.
process.env.JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? 'travelsync-dev-secret-change-me' : '');
process.env.ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,          // Don't block cross-origin images in dev
  crossOriginResourcePolicy: false       // Allow images to be loaded cross-origin
}));

// ─── CORS Configuration ──────────────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    // Allow any localhost origin (for development with dynamic ports)
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

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

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per windowMs
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many AI requests. Please wait a minute.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/trips', (req, res, next) => {
  if (req.path.endsWith('/ai-plan') && req.method === 'POST') {
    return aiLimiter(req, res, next);
  }
  next();
});

// ─── MongoDB Connection ──────────────────────────────────────────────────────
if (mongoUri && process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(mongoUri)
    .then(() => console.log('✓ MongoDB connected successfully'))
    .catch((err) => {
      console.error('✗ MongoDB connection error:', err.message);

      if (isProduction) {
        process.exit(1);
        return;
      }

      console.warn('⚠ Starting without a database connection. API routes that need MongoDB will fail until MONGO_URI is configured.');
    });
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('⚠ MONGO_URI is not configured. Starting the API without a database connection.');
}

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    message: 'TravelSync server is running',
    timestamp: new Date(),
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── Swagger Documentation ──────────────────────────────────────────────────
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api-auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));

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
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ CORS origin: ${corsOptions.origin}`);
  });
}

module.exports = app;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
