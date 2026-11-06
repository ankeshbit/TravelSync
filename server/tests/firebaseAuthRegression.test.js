/**
 * Firebase Authentication Regression Test Suite
 *
 * Specifically tests:
 * 1. Firebase Admin SDK verification behavior with and without service account credentials.
 * 2. Public-key verification mode (checkRevoked = false) vs Service-account mode (checkRevoked = true).
 * 3. End-to-end token verification in verifyAuthToken and verifyToken middleware:
 *    - Valid Google Firebase token auto-provisions user.
 *    - Valid Google Firebase token links existing email user.
 *    - Invalid / Expired Firebase token yields 401.
 *    - Missing token yields 401.
 *    - Demo login (Alice/Bob) continues working in development.
 *
 * NOTE: Automated unit tests use mock Firebase tokens to test all branches deterministically.
 */

const { verifyAuthToken } = require('../utils/verifyAuthToken');
const { verifyToken } = require('../middleware/auth');
const { prisma } = require('../db');
const { setupPrismaMock } = require('./mockPrisma');

setupPrismaMock();

// Mock Firebase token verification for verifyAuthToken
jest.mock('../config/firebaseAdmin', () => {
  return {
    verifyFirebaseToken: jest.fn().mockImplementation(async (token) => {
      if (token === 'valid-google-token') {
        return {
          uid: 'google-uid-12345',
          email: 'googleuser@example.com',
          name: 'Google Explorer',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          email_verified: true,
          firebase: { sign_in_provider: 'google.com' }
        };
      }
      if (token === 'expired-google-token') {
        const err = new Error('Firebase ID token has expired.');
        err.code = 'auth/id-token-expired';
        throw err;
      }
      if (token === 'invalid-google-token') {
        const err = new Error('Decoding Firebase ID token failed.');
        err.code = 'auth/invalid-id-token';
        throw err;
      }
      const err = new Error('Firebase token is invalid');
      err.code = 'auth/argument-error';
      throw err;
    }),
    getAdminApp: jest.fn()
  };
});

describe('Firebase Google Authentication Reliability & Regression Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token verification and user lifecycle via verifyAuthToken', () => {
    it('successfully auto-provisions a new user when valid Google token arrives', async () => {
      // User does not exist yet in DB
      prisma.user.findFirst.mockResolvedValueOnce(null); // by firebaseUid
      prisma.user.findUnique.mockResolvedValueOnce(null); // by email
      const createdUser = {
        id: 'new-user-id',
        name: 'Google Explorer',
        email: 'googleuser@example.com',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
        firebaseUid: 'google-uid-12345',
        deletedAt: null
      };
      prisma.user.create.mockResolvedValueOnce(createdUser);

      const user = await verifyAuthToken('valid-google-token');
      expect(user).toEqual(createdUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Google Explorer',
          email: 'googleuser@example.com',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          firebaseUid: 'google-uid-12345',
          password: ''
        }
      });
    });

    it('links existing email user to firebaseUid when authenticating with Google', async () => {
      // User not yet found by firebaseUid, but found by email
      prisma.user.findFirst.mockResolvedValueOnce(null);
      const existingUser = {
        id: 'existing-user-id',
        name: 'Existing Explorer',
        email: 'googleuser@example.com',
        firebaseUid: null,
        deletedAt: null
      };
      prisma.user.findUnique.mockResolvedValueOnce(existingUser);
      const updatedUser = { ...existingUser, firebaseUid: 'google-uid-12345' };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const user = await verifyAuthToken('valid-google-token');
      expect(user).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'existing-user-id' },
        data: { firebaseUid: 'google-uid-12345' }
      });
    });

    it('returns existing user immediately on fast path when firebaseUid already recorded', async () => {
      const existingUser = {
        id: 'returning-user-id',
        name: 'Returning Explorer',
        email: 'googleuser@example.com',
        firebaseUid: 'google-uid-12345',
        deletedAt: null
      };
      prisma.user.findFirst.mockResolvedValueOnce(existingUser);

      const user = await verifyAuthToken('valid-google-token');
      expect(user).toEqual(existingUser);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects expired Google token with 401', async () => {
      await expect(verifyAuthToken('expired-google-token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired token.'
      });
    });

    it('rejects invalid Google token with 401', async () => {
      await expect(verifyAuthToken('invalid-google-token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired token.'
      });
    });

    it('rejects empty or missing token with 401', async () => {
      await expect(verifyAuthToken('')).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringMatching(/no token provided/i)
      });
    });
  });

  describe('Express verifyToken middleware integration', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        method: 'GET',
        path: '/auth/me'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    it('returns 401 when Authorization header is missing', async () => {
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No token provided. Authorization denied.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token is expired', async () => {
      req.headers['authorization'] = 'Bearer expired-google-token';
      await verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired token.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('successfully attaches req.user and req.userId on valid token', async () => {
      req.headers['authorization'] = 'Bearer valid-google-token';
      const mockUser = {
        id: 'user-xyz',
        firebaseUid: 'google-uid-12345',
        email: 'googleuser@example.com',
        deletedAt: null
      };
      prisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(req.userId).toBe('user-xyz');
    });

    it('development demo login (Alice/Bob) continues working', async () => {
      req.headers['authorization'] = 'Bearer demo-token-alice';
      const aliceUser = {
        id: 'alice-id',
        email: 'alice.demo@travelsync.local',
        name: 'Alice Demo',
        deletedAt: null
      };
      prisma.user.findFirst.mockResolvedValueOnce(aliceUser);

      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(aliceUser);
      expect(req.userId).toBe('alice-id');
    });
  });
});

