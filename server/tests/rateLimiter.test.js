process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.OTP_SECRET = 'test-otp-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: 'test-firebase-uid',
    email: 'test@example.com',
    name: 'Test User'
  }),
  getAdminApp: jest.fn().mockReturnValue({})
}));

const request = require('supertest');
const { setupPrismaMock } = require('./mockPrisma');
setupPrismaMock();

const app = require('../server');

describe('OTP Rate Limiting and Validation', () => {
  it('8 different emails from the same IP get 429 after the 5th', async () => {
    const statuses = [];
    for (let i = 1; i <= 8; i++) {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ email: `different-email-${i}@example.com`, purpose: 'register' });
      statuses.push(res.status);
    }

    // The first 5 should be accepted (not 429)
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    // The 6th, 7th, and 8th requests from the same IP must be 429
    expect(statuses[5]).toBe(429);
    expect(statuses[6]).toBe(429);
    expect(statuses[7]).toBe(429);
  });

  it('a body of { email: 123 } returns 400 (from Zod), not 500', async () => {
    // Test on a fresh express router or instance to avoid IP rate-limit lockout
    const express = require('express');
    const { validate } = require('../middleware/validate');
    const { sendOtpSchema } = require('../validators/auth');
    const testApp = express();
    testApp.use(express.json());
    testApp.post('/api/auth/send-otp', validate({ body: sendOtpSchema }), (req, res) => {
      res.json({ ok: true });
    });
    const { errorHandler } = require('../middleware/errorHandler');
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/api/auth/send-otp')
      .send({ email: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
