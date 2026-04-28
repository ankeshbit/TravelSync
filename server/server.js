require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS Configuration ──────────────────────────────────────────────────────
const corsOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? corsOrigin
    : [/^http:\/\/localhost:\d+$/, corsOrigin],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per windowMs
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// ─── MongoDB Connection ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✓ MongoDB connected successfully'))
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    message: 'TravelSync server is running',
    timestamp: new Date(),
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ CORS origin: ${corsOrigin}`);
});
