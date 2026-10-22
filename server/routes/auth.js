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
const fs = require('fs');
const multer = require('multer');
const config = require('../config/env');
const { prisma, formatUser } = require('../db');

async function detectFileType(buffer) {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const { fileTypeFromBuffer } = await dynamicImport('file-type');
    const result = await fileTypeFromBuffer(buffer);
    if (result) return result;
  } catch (_err) {
    // In environments where dynamic import callback is unavailable (e.g. Jest VM), detect magic bytes
  }

  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return undefined;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return undefined;
}
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { updateProfileSchema, sendOtpSchema, verifyOtpSchema } = require('../validators/auth');
const { sendOtpEmail } = require('../utils/mailer');
const { createOtp, verifyOtp } = require('../utils/otpStore');
const { markUserPendingDeletion, unmarkUserPendingDeletion, markUserDeleted } = require('../utils/verifyAuthToken');
const {
  sendOtpIpLimiter,
  sendOtpEmailLimiter,
  verifyOtpIpLimiter,
  verifyOtpEmailLimiter,
  resolveOtpTargetEmail
} = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const cache = require('../services/cache');
const { getIO, removeAllUsersFromTripRoom } = require('../socket');
const accountDeletion = require('../services/accountDeletionReconciliation');

// ─── Multer Setup ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
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
router.put('/me', verifyToken, validate({ body: updateProfileSchema }), asyncHandler(async (req, res) => {
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

// In-flight deletion tracker to prevent concurrent deletion requests
const activeDeletions = new Set();

/**
 * @swagger
 * /api/auth/me:
 *   delete:
 *     summary: Delete or anonymize user account
 *     description: Deletes user account with OTP verification. Users with expense records are anonymized to preserve ledger integrity. Users who own trips with other members must transfer or delete them first.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 */
router.delete('/me', verifyToken, asyncHandler(async (req, res) => {
  const { otp } = req.body || {};

  if (!otp) {
    return res.status(403).json({ message: 'Valid OTP required for account deletion.' });
  }

  if (activeDeletions.has(req.userId)) {
    return res.status(409).json({
      message: 'Account deletion is already in progress.',
      code: 'DELETION_IN_PROGRESS'
    });
  }
  activeDeletions.add(req.userId);

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const otpResult = await verifyOtp(user.email, otp, 'delete');
    if (!otpResult.ok) {
      return res.status(403).json({ message: otpResult.reason || 'Invalid or expired OTP.' });
    }

    // Item 4: Before deleting anything, if user owns any trip that has OTHER members, return 409 OWNS_SHARED_TRIPS
    const ownedTripsWithOtherMembers = await prisma.trip.findMany({
      where: {
        ownerId: req.userId,
        members: {
          some: {
            userId: { not: req.userId }
          }
        }
      },
      select: { id: true, name: true }
    });

    if (ownedTripsWithOtherMembers.length > 0) {
      const tripNames = ownedTripsWithOtherMembers.map(t => t.name);
      return res.status(409).json({
        message: `Cannot delete account while you own shared trips (${tripNames.join(', ')}). Please transfer ownership or delete these trips first.`,
        code: 'OWNS_SHARED_TRIPS',
        trips: tripNames
      });
    }

    // Query affected trips and members before deletion for cache & socket cleanup
    let affectedTrips = [];
    try {
      affectedTrips = await prisma.trip.findMany({
        where: {
          OR: [
            { ownerId: req.userId },
            { members: { some: { userId: req.userId } } }
          ]
        },
        include: {
          members: { select: { userId: true } }
        }
      });
    } catch (queryErr) {
      logger.warn({ err: queryErr.message }, 'Failed to query affected trips for deletion invalidation');
    }

    // Stage user as pending deletion durably in PostgreSQL and in memory
    markUserPendingDeletion(user.firebaseUid);
    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          deletedAt: user.deletedAt || new Date(),
          refreshToken: 'pending_deletion'
        }
      });
    } catch (stageErr) {
      logger.warn({ err: stageErr.message }, 'Failed to set user status to pending_deletion');
    }

    // Item 3 safe reordering: Run DB work (hard delete or anonymise) inside a transaction FIRST
    let outcome;
    try {
      outcome = await accountDeletion.deleteOrAnonymizeUser(prisma, user);
    } catch (dbErr) {
      logger.error({ err: dbErr.message }, 'Failed to delete user profile from database');
      unmarkUserPendingDeletion(user.firebaseUid);
      try {
        await prisma.user.update({
          where: { id: req.userId },
          data: {
            deletedAt: null,
            refreshToken: null
          }
        });
      } catch (_rollbackErr) {
        logger.warn({ err: _rollbackErr.message }, 'Failed to rollback pending deletion state');
      }
      return res.status(500).json({
        message: 'Failed to delete user profile from database. Account deletion incomplete.',
        code: 'DATABASE_DELETE_FAILED'
      });
    }

    // THEN delete Firebase user (if DB succeeded)
    if (user.firebaseUid) {
      try {
        const { getAdminApp } = require('../config/firebaseAdmin');
        const { getAuth } = require('firebase-admin/auth');
        const adminApp = getAdminApp();
        await getAuth(adminApp).deleteUser(user.firebaseUid);
        markUserDeleted(user.firebaseUid);
      } catch (fbErr) {
        const isNotFound = fbErr && (
          fbErr.code === 'auth/user-not-found' ||
          String(fbErr.message || '').includes('user-not-found')
        );
        if (!isNotFound) {
          logger.warn(
            { err: fbErr.message, userId: user.id },
            'Firebase user deletion failed after DB success; recorded for reconciler'
          );
        } else {
          markUserDeleted(user.firebaseUid);
        }
        // Still return 200 because DB work is complete and user cannot log in
      }
    } else {
      markUserDeleted(user.firebaseUid);
    }

    // Remove the user's uploaded photo file
    if (user.picture && user.picture.startsWith('/uploads/')) {
      const photoPath = path.join(__dirname, '..', user.picture);
      try {
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      } catch (fileErr) {
        logger.warn({ err: fileErr.message }, 'Failed to delete user uploaded photo during account deletion');
      }
    }

    // Cache and socket cleanup (Item 4)
    try {
      const allAffectedUserIds = new Set([req.userId]);
      for (const t of affectedTrips) {
        const memberIds = (t.members || []).map(m => m.userId);
        memberIds.forEach(id => allAffectedUserIds.add(id));

        // Call cache.invalidateTrip
        await cache.invalidateTrip(t.id, memberIds);

        // If trip was owned by user and deleted, notify and clean room
        if (t.ownerId === req.userId && outcome?.deleted) {
          const io = req.io || getIO();
          if (io) {
            io.to(`trip:${t.id}`).emit('trip:deleted', { tripId: t.id });
          }
          await removeAllUsersFromTripRoom(t.id, { silent: true });
        }
      }

      await cache.invalidateUserDashboard(Array.from(allAffectedUserIds));
      await cache.invalidateExplore(req.userId);
    } catch (cleanupErr) {
      logger.warn({ err: cleanupErr.message }, 'Post-deletion cache/socket cleanup warning');
    }

    res.json({ message: 'Account deleted successfully.' });
  } finally {
    activeDeletions.delete(req.userId);
  }
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    asyncHandler(async (innerReq, innerRes) => {
      const typeResult = await detectFileType(innerReq.file.buffer);
      const ALLOWED_MIMES = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
      };

      if (!typeResult || !ALLOWED_MIMES[typeResult.mime]) {
        return innerRes.status(400).json({
          message: 'Invalid image format. Only JPEG, PNG, WebP, and GIF images are allowed.'
        });
      }

      const user = await prisma.user.findUnique({ where: { id: innerReq.userId } });
      if (!user) return innerRes.status(404).json({ message: 'User not found.' });

      // Delete user's previous photo if in /uploads/
      if (user.picture && user.picture.startsWith('/uploads/')) {
        const oldPhotoPath = path.join(__dirname, '..', user.picture);
        try {
          if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
          }
        } catch (e) {
          logger.warn({ err: e }, 'Failed to delete previous profile photo');
        }
      }

      const ext = ALLOWED_MIMES[typeResult.mime];
      const filename = `user-${innerReq.userId}-${Date.now()}.${ext}`;
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const targetPath = path.join(uploadsDir, filename);
      fs.writeFileSync(targetPath, innerReq.file.buffer);

      const pictureUrl = `/uploads/${filename}`;
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
router.post(
  '/send-otp',
  resolveOtpTargetEmail,
  sendOtpIpLimiter,
  sendOtpEmailLimiter,
  validate({ body: sendOtpSchema }),
  asyncHandler(async (req, res) => {
    const { purpose = 'register' } = req.body;

    let targetEmail = req.targetEmail || (typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '');

    // For delete, look up the authenticated user's email
    if (purpose === 'delete') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Authentication required.' });

      try {
        const { verifyFirebaseToken } = require('../config/firebaseAdmin');
        const decoded = await verifyFirebaseToken(token);
        targetEmail = (decoded.email || targetEmail).toLowerCase().trim();
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
  })
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP code
 *     tags: [Auth]
 */
router.post(
  '/verify-otp',
  resolveOtpTargetEmail,
  verifyOtpIpLimiter,
  verifyOtpEmailLimiter,
  validate({ body: verifyOtpSchema }),
  asyncHandler(async (req, res) => {
    const { email, otp, purpose = 'register' } = req.body;

    // Hardening (Item 10): purpose: 'delete' requires a valid Bearer token whose email matches target email
    if (purpose === 'delete') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      let authedUser;
      try {
        const { verifyAuthToken } = require('../utils/verifyAuthToken');
        authedUser = await verifyAuthToken(token);
      } catch (err) {
        return res.status(err.statusCode || 401).json({ message: err.message || 'Invalid or expired token.' });
      }
      const targetEmail = (email || '').toLowerCase().trim();
      if (!authedUser || !authedUser.email || authedUser.email.toLowerCase().trim() !== targetEmail) {
        return res.status(401).json({ message: 'Token email does not match requested email.' });
      }
    }

    const result = await verifyOtp(email.toLowerCase().trim(), otp, purpose);
    if (!result.ok) {
      return res.status(400).json({ message: result.reason });
    }

    res.json({ verified: true, message: 'Email verified successfully.' });
  })
);

module.exports = router;
