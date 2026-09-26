const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const { prisma, formatUser } = require('../db');
const { verifyToken } = require('../middleware/auth');
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

// Helper to generate access and refresh tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_SECRET || 'fallback-refresh-secret', { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, otpVerified]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: pass123
 *               otpVerified:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request (missing fields, already registered)
 *       403:
 *         description: OTP verification required
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otpVerified } = req.body;

    if (!otpVerified) {
      return res.status(403).json({ message: 'Email verification required before registration.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user directly to Neon PostgreSQL
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword
      }
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedToken }
    });

    // Also register in Neon Auth in background (non-blocking)
    if (process.env.NEON_AUTH_URL) {
      fetch(`${process.env.NEON_AUTH_URL}/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
        },
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password })
      }).catch(e => console.warn('Non-blocking Neon Auth signup sync:', e.message));
    }

    res.status(201).json({
      message: 'User registered successfully.',
      accessToken,
      refreshToken,
      user: { id: user.id, _id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive JWT tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: pass123
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid fields or credentials
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Fast Direct Database Lookup (~20ms) ────────────────────────────────
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user && user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const { accessToken, refreshToken } = generateTokens(user.id);
        const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: hashedToken }
        });

        return res.json({
          message: 'Login successful.',
          accessToken,
          refreshToken,
          user: { id: user.id, _id: user.id, name: user.name, email: user.email }
        });
      }
    }

    // ── 2. Fallback to Neon Auth API (if user was created via Neon Auth portal) ─
    if (process.env.NEON_AUTH_URL) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const neonRes = await fetch(`${process.env.NEON_AUTH_URL}/sign-in/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
          },
          body: JSON.stringify({ email: normalizedEmail, password }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const neonData = await neonRes.json();
        if (neonRes.ok && neonData.user) {
          const syncedUser = await prisma.user.upsert({
            where: { id: neonData.user.id },
            update: { name: neonData.user.name, email: neonData.user.email },
            create: {
              id: neonData.user.id,
              name: neonData.user.name || normalizedEmail.split('@')[0],
              email: neonData.user.email,
              password: ''
            }
          });

          return res.json({
            message: 'Login successful via Neon Auth.',
            accessToken: neonData.token,
            refreshToken: neonData.token,
            user: { id: syncedUser.id, _id: syncedUser.id, name: syncedUser.name, email: syncedUser.email }
          });
        }
      } catch (neonErr) {
        console.warn('Neon Auth sign-in fallback triggered:', neonErr.message);
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(401).json({ message: 'Invalid email or password.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using rotating refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsIn...
 *     responses:
 *       200:
 *         description: Tokens refreshed
 *       401:
 *         description: Invalid or mismatched refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    // 1. Check Neon Auth session in database
    try {
      const sessionRows = await prisma.$queryRawUnsafe(
        'SELECT "userId", "expiresAt" FROM neon_auth.session WHERE token = $1 AND "expiresAt" > NOW()',
        refreshToken
      );
      if (sessionRows && sessionRows.length > 0) {
        const user = await prisma.user.findUnique({ where: { id: sessionRows[0].userId } });
        return res.json({
          accessToken: refreshToken,
          refreshToken: refreshToken,
          user: user ? formatUser(user) : undefined
        });
      }
    } catch {}

    // 2. Fallback to local JWT tokens
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET || 'fallback-refresh-secret');
    } catch (e) {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const hashedIncoming = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (!user || user.refreshToken !== hashedIncoming) {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    const hashedToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedToken }
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: formatUser(user)
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and clear refresh token
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        await prisma.$queryRawUnsafe('DELETE FROM neon_auth.session WHERE token = $1', token);
      } catch {}
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { refreshToken: null }
    }).catch(() => {});

    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Unauthorized
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, picture: true, createdAt: true }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(formatUser(user));
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Name
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/me', verifyToken, async (req, res) => {
  try {
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

    // Also update neon_auth.user if it exists
    try {
      await prisma.$queryRawUnsafe(
        'UPDATE neon_auth.user SET name = $1 WHERE id = $2',
        updated.name,
        req.userId
      );
    } catch {}

    res.json({ id: updated.id, _id: updated.id, name: updated.name, email: updated.email });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   delete:
 *     summary: Delete user account
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otpVerified]
 *             properties:
 *               otpVerified:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/me', verifyToken, async (req, res) => {
  try {
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

    // Also delete from neon_auth.user
    try {
      await prisma.$queryRawUnsafe('DELETE FROM neon_auth.user WHERE id = $1', req.userId);
    } catch {}

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: 'Server error. Failed to delete account.' });
  }
});

/**
 * @swagger
 * /api/auth/me/password:
 *   put:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */
router.put('/me/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch && user.password) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * @swagger
 * /api/auth/upload-photo:
 *   post:
 *     summary: Upload profile photo
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Photo uploaded
 */
router.post('/upload-photo', verifyToken, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) return res.status(404).json({ message: 'User not found.' });

      const pictureUrl = `/uploads/${req.file.filename}`;
      await prisma.user.update({
        where: { id: req.userId },
        data: { picture: pictureUrl }
      });

      try {
        await prisma.$queryRawUnsafe('UPDATE neon_auth.user SET image = $1 WHERE id = $2', pictureUrl, req.userId);
      } catch {}

      res.json({ pictureUrl });
    } catch (dbErr) {
      console.error('Upload-photo DB error:', dbErr);
      res.status(500).json({ message: 'Server error saving photo.' });
    }
  });
});

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP code to email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, purpose]
 *             properties:
 *               email:
 *                 type: string
 *               purpose:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP code sent
 */
const otpLastSent = new Map();

router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !['register', 'delete'].includes(purpose)) {
      return res.status(400).json({ message: 'Valid email and purpose are required.' });
    }

    let targetEmail = email.toLowerCase().trim();
    if (purpose === 'delete') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Authentication required.' });
      try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { email: true }
        });
        if (!user) return res.status(404).json({ message: 'User not found.' });
        targetEmail = user.email;
      } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }
    }

    const lastSent = otpLastSent.get(targetEmail);
    if (lastSent && Date.now() - lastSent < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({ message: `Please wait ${wait}s before requesting a new code.` });
    }

    const otp = await createOtp(targetEmail, purpose);
    const mailResult = await sendOtpEmail(targetEmail, otp, purpose);
    otpLastSent.set(targetEmail, Date.now());

    res.json({
      message: mailResult?.dev
        ? 'Verification code generated (check terminal or dev hint).'
        : 'Verification code sent to your email.',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ message: 'Failed to send verification code. Check your SMTP config.' });
  }
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, purpose]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               purpose:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
    }

    const result = await verifyOtp(email.toLowerCase().trim(), otp, purpose);
    if (!result.ok) {
      return res.status(400).json({ message: result.reason });
    }

    res.json({ verified: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ message: 'Server error during verification.' });
  }
});

module.exports = router;
