const express = require('express');
const jwt = require('jsonwebtoken');
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully.',
      token,
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// Token invalidation is handled client-side (delete from localStorage).
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully.' });
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
