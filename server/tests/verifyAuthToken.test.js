const { verifyAuthToken } = require('../utils/verifyAuthToken');
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

setupPrismaMock();

// Mock Firebase token verification
jest.mock('../config/firebaseAdmin', () => ({
  verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
    if (token === 'valid-firebase-token') {
      return {
        uid: 'fb-test-uid-1',
        email: 'test@example.com',
        name: 'Test User',
        email_verified: true
      };
    }
    if (token === 'unverified-firebase-token') {
      return {
        uid: 'fb-unverified-uid',
        email: 'unverified@example.com',
        name: 'Unverified User',
        email_verified: false
      };
    }
    const err = new Error('Firebase ID token has expired or is invalid.');
    err.code = 'auth/id-token-expired';
    throw err;
  }),
  getAdminApp: jest.fn()
}));

describe('verifyAuthToken & auth middleware reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAuthToken error classification', () => {
    it('throws 401 when token is missing or empty', async () => {
      await expect(verifyAuthToken('')).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringMatching(/no token provided/i)
      });
    });

    it('throws 401 when Firebase token is invalid/expired', async () => {
      await expect(verifyAuthToken('bogus-token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired token.'
      });
    });

    it('throws 403 with code EMAIL_NOT_VERIFIED when user email is not verified', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(verifyAuthToken('unverified-firebase-token')).rejects.toMatchObject({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED'
      });
    });

    it('does NOT mask database error P2022 as 401 invalid token, but throws 500', async () => {
      const p2022Err = new Error('The column `users.deletedAt` does not exist in the current database.');
      p2022Err.code = 'P2022';
      prisma.user.findFirst.mockRejectedValueOnce(p2022Err);

      await expect(verifyAuthToken('valid-firebase-token')).rejects.toMatchObject({
        statusCode: 500,
        code: 'P2022'
      });
    });

    it('throws 503 when database is down (P1001)', async () => {
      const downErr = new Error("Can't reach database server");
      downErr.code = 'P1001';
      prisma.user.findFirst.mockRejectedValueOnce(downErr);

      await expect(verifyAuthToken('valid-firebase-token')).rejects.toMatchObject({
        statusCode: 503,
        message: expect.stringMatching(/database service unavailable/i)
      });
    });

    it('successfully returns user when Firebase token is valid and DB query succeeds', async () => {
      const mockUser = {
        id: 'user-123',
        firebaseUid: 'fb-test-uid-1',
        email: 'test@example.com',
        name: 'Test User',
        deletedAt: null
      };
      prisma.user.findFirst.mockResolvedValueOnce(mockUser);

      const user = await verifyAuthToken('valid-firebase-token');
      expect(user).toEqual(mockUser);
    });
  });

  describe('verifyToken Express middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        method: 'GET',
        path: '/trips'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    it('returns 401 if Authorization header is missing', async () => {
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/no token provided/i)
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 when database throws an unexpected error during token verification', async () => {
      req.headers['authorization'] = 'Bearer valid-firebase-token';
      const dbErr = new Error('Database syntax error');
      prisma.user.findFirst.mockRejectedValueOnce(dbErr);

      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Database syntax error'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 503 when database is unavailable', async () => {
      req.headers['authorization'] = 'Bearer valid-firebase-token';
      const downErr = new Error("Can't reach database server");
      downErr.code = 'P1001';
      prisma.user.findFirst.mockRejectedValueOnce(downErr);

      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/database service unavailable/i)
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('attaches user to req and calls next() on success', async () => {
      req.headers['authorization'] = 'Bearer valid-firebase-token';
      const mockUser = { id: 'u1', firebaseUid: 'fb-test-uid-1' };
      prisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(req.userId).toBe('u1');
    });

    describe('no dev-token backdoor exists across any environment', () => {
      const envs = ['development', 'test', 'staging', undefined];
      envs.forEach((env) => {
        it(`rejects Authorization: Bearer dev-token with 401 when NODE_ENV is ${env}`, async () => {
          const origEnv = process.env.NODE_ENV;
          if (env === undefined) {
            delete process.env.NODE_ENV;
          } else {
            process.env.NODE_ENV = env;
          }
          try {
            req.headers['authorization'] = 'Bearer dev-token';
            await verifyToken(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();

            await expect(verifyAuthToken('dev-token')).rejects.toMatchObject({
              statusCode: 401
            });
          } finally {
            if (origEnv === undefined) {
              delete process.env.NODE_ENV;
            } else {
              process.env.NODE_ENV = origEnv;
            }
          }
        });
      });
    });
  });
});
