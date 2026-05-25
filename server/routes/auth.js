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

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const user = new User({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id);
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshToken = hashedToken;
    await user.save();

    res.status(201).json({
      message: 'User registered successfully.',
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email }
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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' }); // 404 per API test requirement
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' }); // 401 per API test requirement
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshToken = hashedToken;
    await user.save();

    res.json({
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email }
    });
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

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET || 'fallback-refresh-secret');
    } catch (e) {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(decoded.userId);
    const hashedIncoming = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (!user || user.refreshToken !== hashedIncoming) {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    const hashedToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    user.refreshToken = hashedToken;
    await user.save();

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
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
    await User.findByIdAndUpdate(req.userId, { refreshToken: null });
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

    const Trip = require('../models/Trip');

    // Cascade-delete all trips owned by this user
    await Trip.deleteMany({ ownerId: req.userId });

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
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ message: 'User not found.' });

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
