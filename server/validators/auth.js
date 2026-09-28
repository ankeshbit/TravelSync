const { z } = require('zod');

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  purpose: z.enum(['register', 'delete']).optional().default('register')
});

const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  purpose: z.enum(['register', 'delete']).optional().default('register')
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name must be 100 characters or fewer').optional()
});

module.exports = {
  sendOtpSchema,
  verifyOtpSchema,
  updateProfileSchema
};
