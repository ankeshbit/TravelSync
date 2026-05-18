const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
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

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshHashSecret = () => process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

const hashRefreshToken = (token) => {
  return crypto.createHmac('sha256', getRefreshHashSecret()).update(token).digest('hex');
};

const createAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
};

const createRefreshTokenPayload = () => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return {
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  };
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/api/auth',
});

const getRefreshClearCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Frontend must first call /send-otp then /verify-otp and pass otpVerified:true
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

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const accessToken = createAccessToken(user._id);
    const { refreshToken, refreshTokenHash, expiresAt } = createRefreshTokenPayload();

    await User.findByIdAndUpdate(user._id, {
      $push: {
        refreshTokens: {
          tokenHash: refreshTokenHash,
          expiresAt,
          createdAt: new Date(),
        }
      }
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    res.status(201).json({
      message: 'User registered successfully.',
      accessToken,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const accessToken = createAccessToken(user._id);
    const { refreshToken, refreshTokenHash, expiresAt } = createRefreshTokenPayload();

    await User.updateOne(
      { _id: user._id },
      { $pull: { refreshTokens: { expiresAt: { $lte: new Date() } } } }
    );

    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          refreshTokens: {
            tokenHash: refreshTokenHash,
            expiresAt,
            createdAt: new Date(),
          }
        }
      }
    );

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    res.json({
      message: 'Login successful.',
      accessToken,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    const oldTokenHash = hashRefreshToken(refreshToken);
    const { refreshToken: newRefreshToken, refreshTokenHash: newTokenHash, expiresAt } = createRefreshTokenPayload();

    // Atomic rotation in one update pipeline: prune expired + remove old + append new.
    const updatedUser = await User.findOneAndUpdate(
      {
        refreshTokens: {
          $elemMatch: {
            tokenHash: oldTokenHash,
            expiresAt: { $gt: new Date() }
          }
        }
      },
      [
        {
          $set: {
            refreshTokens: {
              $filter: {
                input: '$refreshTokens',
                as: 'rt',
                cond: {
                  $and: [
                    { $gt: ['$$rt.expiresAt', new Date()] },
                    { $ne: ['$$rt.tokenHash', oldTokenHash] }
                  ]
                }
              }
            }
          }
        },
        {
          $set: {
            refreshTokens: {
              $concatArrays: [
                '$refreshTokens',
                [
                  {
                    tokenHash: newTokenHash,
                    expiresAt,
                    createdAt: new Date(),
                  }
                ]
              ]
            }
          }
        }
      ],
      { new: true, updatePipeline: true }
    );

    if (!updatedUser) {
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshClearCookieOptions());
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const accessToken = createAccessToken(updatedUser._id);
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());

    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $pull: { refreshTokens: { tokenHash } } }
      );
    }

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshClearCookieOptions());
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── GET /api/auth/me (Protected) ────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── PUT /api/auth/me (Update Profile) ──────────────────────────────────────
router.put('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (req.body.name) {
      user.name = req.body.name;
    }
    await user.save();

    res.json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── DELETE /api/auth/me (Delete Account) ─────────────────────────────────────
// Frontend must first call /send-otp (purpose:delete) then /verify-otp and pass otpVerified:true
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const { otpVerified } = req.body;

    if (!otpVerified) {
      return res.status(403).json({ message: 'Email verification required before account deletion.' });
    }

    const Trip = require('../models/Trip');

    // Cascade-delete all trips owned by this user
    await Trip.deleteMany({ createdBy: req.userId });

    // Delete the user document
    const deletedUser = await User.findByIdAndDelete(req.userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: 'Server error. Failed to delete account.' });
  }
});

// ─── PUT /api/auth/me/password (Change Password) ────────────────────────────
router.put('/me/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─── POST /api/auth/upload-photo (Upload Profile Picture) ────────────────────
router.post('/upload-photo', verifyToken, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ message: 'User not found.' });

      // Build a URL path the client can use: /uploads/<filename>
      const pictureUrl = `/uploads/${req.file.filename}`;
      user.picture = pictureUrl;
      await user.save();

      res.json({ pictureUrl });
    } catch (dbErr) {
      console.error('Upload-photo DB error:', dbErr);
      res.status(500).json({ message: 'Server error saving photo.' });
    }
  });
});

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────
// purpose: 'register' | 'delete'
// For 'delete', user must be authenticated.
const otpLastSent = new Map(); // basic rate-limit: one email per 60s per address

router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !['register', 'delete'].includes(purpose)) {
      return res.status(400).json({ message: 'Valid email and purpose are required.' });
    }

    // For delete: resolve email from JWT token instead of trusting client body
    let targetEmail = email.toLowerCase();
    if (purpose === 'delete') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Authentication required.' });
      try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('email');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        targetEmail = user.email;
      } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }
    }

    // Rate-limit: 60 seconds between sends for the same email
    const lastSent = otpLastSent.get(targetEmail);
    if (lastSent && Date.now() - lastSent < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({ message: `Please wait ${wait}s before requesting a new code.` });
    }

    const otp = await createOtp(targetEmail, purpose);
    await sendOtpEmail(targetEmail, otp, purpose);
    otpLastSent.set(targetEmail, Date.now());

    res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ message: 'Failed to send verification code. Check your SMTP config.' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
    }

    const result = await verifyOtp(email.toLowerCase(), otp, purpose);
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
