// auth.js — Backend authentication routes (Firebase migration)
//
// POST /api/auth/logout         — invalidate any server-side session metadata
// GET  /api/auth/me             — return/create the PostgreSQL user (called by auth store after login)
// PUT  /api/auth/me             — update display name
// DELETE /api/auth/me           — delete account (requires Firebase re-auth on client)
// PUT  /api/auth/me/password    — REMOVED: Firebase handles passwords
// POST /api/auth/upload-photo   — upload profile picture
// POST /api/auth/send-otp       — OTP for account deletion verification (kept)
// POST /api/auth/verify-otp     — verify OTP (kept)
//
// Routes /register, /login, /refresh are no longer used by the frontend
// but are kept returning 410 Gone so external callers get a clear message.

const express = require('express');
const path = require('path');
const multer = require('multer');
const config = require('../config/env');
const { prisma, formatUser } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendOtpEmail } = require('../utils/mailer');
const { createOtp, verifyOtp } = require('../utils/otpStore');

// ─── Multer Setup ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${req.userId}-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

const router = express.Router();

// ─── Deprecated endpoints (kept to avoid silent failures) ─────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: "[Deprecated] Registration is now handled by Firebase"
 *     tags: [Auth]
 *     responses:
 *       410:
 *         description: Gone — use Firebase Authentication
 */
router.post('/register', (req, res) => {
  res.status(410).json({
    message: 'Registration is now handled by Firebase Authentication. Use the app UI to register.'
  });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: "[Deprecated] Login is now handled by Firebase"
 *     tags: [Auth]
 *     responses:
 *       410:
 *         description: Gone — use Firebase Authentication
 */
router.post('/login', (req, res) => {
  res.status(410).json({
    message: 'Login is now handled by Firebase Authentication. Use the app UI to sign in.'
  });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: "[Deprecated] Token refresh is now handled by Firebase"
 *     tags: [Auth]
 *     responses:
 *       410:
 *         description: Gone — Firebase manages token refresh automatically
 */
router.post('/refresh', (req, res) => {
  res.status(410).json({
    message: 'Token refresh is now handled by Firebase. The SDK refreshes tokens automatically.'
  });
});

// ─── Active endpoints ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout — clear server-side session metadata
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
  // Clear the legacy refresh token field (non-fatal if it fails)
  await prisma.user.update({
    where: { id: req.userId },
    data: { refreshToken: null }
  }).catch(() => {});

  res.json({ message: 'Logged out' });
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 */
router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, picture: true, createdAt: true }
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  res.json(formatUser(user));
}));

/**
 * @swagger
 * /api/auth/me:
 *   put:
 *     summary: Update user display name
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 */
router.put('/me', verifyToken, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const updateData = {};
  if (req.body.name) {
    updateData.name = req.body.name.trim();
  }

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: updateData
  });

  res.json({ id: updated.id, _id: updated.id, name: updated.name, email: updated.email });
}));

/**
 * @swagger
 * /api/auth/me/password:
 *   put:
 *     summary: "[Deprecated] Password management is now handled by Firebase"
 *     tags: [Auth]
 *     responses:
 *       410:
 *         description: Gone — use Firebase password reset
 */
router.put('/me/password', (req, res) => {
  res.status(410).json({
    message: 'Password management is now handled by Firebase. Use the Forgot Password flow.'
  });
});

/**
 * @swagger
 * /api/auth/me:
 *   delete:
 *     summary: Delete user account
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 */
router.delete('/me', verifyToken, asyncHandler(async (req, res) => {
  const { otpVerified } = req.body;

  if (!otpVerified) {
    return res.status(403).json({ message: 'Email verification required before account deletion.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Cascade deletion handles owned trips and member associations
  await prisma.user.delete({ where: { id: req.userId } });

  res.json({ message: 'Account deleted successfully.' });
}));

/**
 * @swagger
 * /api/auth/upload-photo:
 *   post:
 *     summary: Upload profile photo
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 */
router.post('/upload-photo', verifyToken, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    asyncHandler(async (innerReq, innerRes) => {
      const user = await prisma.user.findUnique({ where: { id: innerReq.userId } });
      if (!user) return innerRes.status(404).json({ message: 'User not found.' });

      const pictureUrl = `/uploads/${innerReq.file.filename}`;
      await prisma.user.update({
        where: { id: innerReq.userId },
        data: { picture: pictureUrl }
      });

      innerRes.json({ pictureUrl });
    })(req, res, next);
  });
});

// ─── OTP endpoints (kept — used for account deletion verification) ─────────────

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP code to email (account deletion only)
 *     tags: [Auth]
 */
router.post('/send-otp', asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;

  if (!email || !['register', 'delete'].includes(purpose)) {
    return res.status(400).json({ message: 'Valid email and purpose are required.' });
  }

  let targetEmail = email.toLowerCase().trim();

  // For delete, look up the authenticated user's email
  if (purpose === 'delete') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    try {
      const { verifyFirebaseToken } = require('../config/firebaseAdmin');
      const decoded = await verifyFirebaseToken(token);
      targetEmail = decoded.email || targetEmail;
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  }

  let otp;
  try {
    otp = await createOtp(targetEmail, purpose);
  } catch (err) {
    if (err.statusCode === 429) {
      return res.status(429).json({ message: err.message, cooldownSeconds: err.cooldownSeconds });
    }
    throw err;
  }

  const mailResult = await sendOtpEmail(targetEmail, otp, purpose);

  const isProd = config.isProduction || process.env.NODE_ENV === 'production';
  const responseData = {
    message: mailResult?.dev
      ? 'Verification code generated (check terminal or dev hint).'
      : 'Verification code sent to your email.'
  };

  if (!isProd && otp) {
    responseData.devOtp = otp;
  }

  res.json(responseData);
}));

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP code
 *     tags: [Auth]
 */
router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { email, otp, purpose } = req.body;

  if (!email || !otp || !purpose) {
    return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
  }

  const result = await verifyOtp(email.toLowerCase().trim(), otp, purpose);
  if (!result.ok) {
    return res.status(400).json({ message: result.reason });
  }

  res.json({ verified: true, message: 'Email verified successfully.' });
}));

module.exports = router;
