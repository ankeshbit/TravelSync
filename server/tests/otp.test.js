process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-validation-ok';
process.env.REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-validation-ok';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

// Mock Firebase Admin verification before requiring modules
jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'valid-firebase-token') {
      return {
        uid: 'test-firebase-uid',
        email: 'firebase-user@example.com',
        name: 'Firebase User'
      };
    }
    throw new Error('Invalid token');
  }),
  getAdminApp: jest.fn()
}));

jest.setTimeout(30000);

const crypto = require('crypto');
const {
  createOtp,
  verifyOtp,
  cleanupExpiredOtps,
  compareHashes
} = require('../utils/otpStore');
const { sendOtpEmail } = require('../utils/mailer');
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');

describe('OTP System and Auth Hardening', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Cleanup test records
    try {
      await prisma.otp.deleteMany({
        where: { email: { contains: 'test-otp-' } }
      });
    } catch (_err) {
      // ignore
    }
  });

  describe('1. Cryptographic OTP Generation', () => {
    it('should generate a 6-digit OTP using crypto.randomInt(100000, 1000000)', async () => {
      const randomIntSpy = jest.spyOn(crypto, 'randomInt');
      const mathRandomSpy = jest.spyOn(Math, 'random');

      const email = `crypto-test-${Date.now()}@example.com`;
      const otp = await createOtp(email, 'register');

      expect(randomIntSpy).toHaveBeenCalledWith(100000, 1000000);
      expect(mathRandomSpy).not.toHaveBeenCalled();
      expect(otp).toMatch(/^\d{6}$/);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    });
  });

  describe('2. Attempts Counter and Invalidation (Max 5)', () => {
    it('should track incorrect attempts and invalidate after 5 wrong tries', async () => {
      const email = `attempts-${Date.now()}@example.com`;
      const plainOtp = await createOtp(email, 'delete');

      // Try with wrong OTPs 1 to 4
      for (let attempt = 1; attempt <= 4; attempt++) {
        const result = await verifyOtp(email, '000000', 'delete');
        expect(result.ok).toBe(false);
        expect(result.attemptsRemaining).toBe(5 - attempt);
      }

      // 5th wrong attempt should invalidate the OTP completely
      const finalFail = await verifyOtp(email, '000000', 'delete');
      expect(finalFail.ok).toBe(false);
      expect(finalFail.reason).toContain('Too many incorrect attempts');

      // Verify row was deleted from DB
      const rowInDb = await prisma.otp.findFirst({
        where: { email, purpose: 'delete' }
      });
      expect(rowInDb).toBeNull();

      // Even providing the original correct OTP now must fail
      const tryOriginal = await verifyOtp(email, plainOtp, 'delete');
      expect(tryOriginal.ok).toBe(false);
      expect(tryOriginal.reason).toContain('No verification code found');
    });

    it('should successfully verify when given the right OTP and remove single-use entry', async () => {
      const email = `verify-success-${Date.now()}@example.com`;
      const plainOtp = await createOtp(email, 'register');

      const result = await verifyOtp(email, plainOtp, 'register');
      expect(result.ok).toBe(true);

      // Single-use: Subsequent verification must fail
      const secondTry = await verifyOtp(email, plainOtp, 'register');
      expect(secondTry.ok).toBe(false);
    });
  });

  describe('3. 60-Second Resend Cooldown', () => {
    it('should reject a second OTP request within 60 seconds with 429', async () => {
      const email = `cooldown-${Date.now()}@example.com`;
      await createOtp(email, 'register');

      // Second immediate request
      await expect(createOtp(email, 'register')).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining('Please wait')
      });
    });

    it('should allow OTP generation if past the cooldown window', async () => {
      const email = `cooldown-past-${Date.now()}@example.com`;
      await createOtp(email, 'register');

      // Manually simulate that the record was created 61 seconds ago
      await prisma.otp.updateMany({
        where: { email, purpose: 'register' },
        data: { createdAt: new Date(Date.now() - 65 * 1000) }
      });

      // Now createOtp should succeed
      const newOtp = await createOtp(email, 'register');
      expect(newOtp).toMatch(/^\d{6}$/);
    });
  });

  describe('4. Prisma Otp Model & Expired Row Cleanup', () => {
    it('should store OTP with email, hash, purpose, expiresAt, and attempts', async () => {
      const email = `model-test-${Date.now()}@example.com`;
      const plainOtp = await createOtp(email, 'register');

      const dbEntry = await prisma.otp.findFirst({
        where: { email, purpose: 'register' }
      });

      expect(dbEntry).toBeDefined();
      expect(dbEntry.email).toBe(email);
      expect(dbEntry.purpose).toBe('register');
      expect(dbEntry.attempts).toBe(0);
      expect(dbEntry.hash).not.toBe(plainOtp); // Plain text never stored
      expect(dbEntry.hash.length).toBe(64); // 64-char SHA256 hex
      expect(new Date(dbEntry.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should delete expired OTP rows via cleanupExpiredOtps', async () => {
      const email = `cleanup-${Date.now()}@example.com`;
      await createOtp(email, 'register');

      // Set expiresAt to the past
      await prisma.otp.updateMany({
        where: { email },
        data: { expiresAt: new Date(Date.now() - 1000) }
      });

      const deletedCount = await cleanupExpiredOtps();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const remaining = await prisma.otp.findFirst({ where: { email } });
      expect(remaining).toBeNull();
    });
  });

  describe('5. Timing-Safe Hash Comparison (crypto.timingSafeEqual)', () => {
    it('should call crypto.timingSafeEqual during OTP verification', async () => {
      const timingSafeSpy = jest.spyOn(crypto, 'timingSafeEqual');

      const email = `timing-safe-${Date.now()}@example.com`;
      const otp = await createOtp(email, 'register');

      await verifyOtp(email, otp, 'register');

      expect(timingSafeSpy).toHaveBeenCalled();
      const [bufA, bufB] = timingSafeSpy.mock.calls[0];
      expect(Buffer.isBuffer(bufA)).toBe(true);
      expect(Buffer.isBuffer(bufB)).toBe(true);
      expect(bufA.length).toBe(bufB.length);
    });

    it('compareHashes helper returns false on mismatched or invalid inputs', () => {
      expect(compareHashes('abc', 'def')).toBe(false);
      expect(compareHashes('', '')).toBe(false);
      expect(compareHashes(null, 'def')).toBe(false);
    });
  });

  describe('6. Mailer & Production Security', () => {
    it('should NOT log OTP to console when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await sendOtpEmail('test@example.com', '123456', 'register');
      } catch (_err) {
        // expected in test environment without SMTP
      }

      // Expect that none of the console.log calls contain the OTP
      const allLoggedText = consoleLogSpy.mock.calls.map(args => args.join(' ')).join('\n');
      expect(allLoggedText).not.toContain('123456');
    });

    it('should log OTP to console when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await sendOtpEmail('test@example.com', '654321', 'register');
      } catch (_err) {
        // expected in test environment without SMTP
      }

      const allLoggedText = consoleLogSpy.mock.calls.map(args => args.join(' ')).join('\n');
      expect(allLoggedText).toContain('654321');
    });
  });

  describe('7. Auth Middleware & DB Down Handling (503 vs 401)', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let consoleErrorSpy;

    beforeEach(() => {
      mockReq = {
        headers: {
          authorization: 'Bearer sample-test-token-xyz'
        }
      };
      mockRes = {
        statusCode: null,
        status: jest.fn().mockImplementation(function (code) {
          this.statusCode = code;
          return this;
        }),
        json: jest.fn().mockImplementation(function (data) {
          this.body = data;
          return this;
        })
      };
      mockNext = jest.fn();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should return 401 for an invalid or expired token when DB is healthy', async () => {
      await verifyToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/invalid|expired/i) })
      );
    });

    it('should return 503 and log error if the database is down during token verification', async () => {
      // Simulate database down error from Prisma $queryRaw
      const dbDownError = new Error('Can\'t reach database server at ep-withered-dew.neon.tech:5432. Please make sure your database server is running.');
      dbDownError.code = 'P1001';
      dbDownError.name = 'PrismaClientInitializationError';

      jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(dbDownError);

      await verifyToken(mockReq, mockRes, mockNext);

      // Verify DB error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Verify HTTP 503 is returned, NOT 401
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/database service unavailable/i) })
      );
    });

    it('should cache Neon session check for a few seconds', async () => {
      const testToken = `neon-test-token-${Date.now()}`;
      const fakeUserId = `neon-user-${Date.now()}`;

      // Mock $queryRaw to return a valid session once
      const queryRawSpy = jest.spyOn(prisma, '$queryRaw').mockResolvedValue([
        { userId: fakeUserId, expiresAt: new Date(Date.now() + 60000) }
      ]);
      const findUniqueSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: fakeUserId,
        email: 'neon@example.com',
        name: 'Neon User'
      });

      const sessionReq = {
        headers: { authorization: `Bearer ${testToken}` }
      };

      // First call: hits DB
      await verifyToken(sessionReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(queryRawSpy).toHaveBeenCalledTimes(1);
      expect(findUniqueSpy).toHaveBeenCalledTimes(1);

      // Second call immediately with same token: should use cache, not query DB again
      const mockNext2 = jest.fn();
      await verifyToken(sessionReq, mockRes, mockNext2);
      expect(mockNext2).toHaveBeenCalledTimes(1);
      expect(queryRawSpy).toHaveBeenCalledTimes(1); // Still 1, did not re-query
    });
  });
});
