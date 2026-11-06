/**
 * Direct Unit Tests for firebaseAdmin.js
 *
 * Verifies:
 * - getAdminApp initializes cleanly with projectId.
 * - verifyFirebaseToken passes checkRevoked=false when service account is not present.
 * - verifyFirebaseToken passes checkRevoked=true when service account is present.
 */

describe('firebaseAdmin module direct behavior', () => {
  let originalEnv;

  beforeEach(() => {
    jest.resetModules();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls verifyIdToken with false when service account credentials are not provided', async () => {
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.FIREBASE_PROJECT_ID = 'travelsync-65565';

    const mockVerifyIdToken = jest.fn().mockResolvedValue({
      uid: 'user-abc',
      email: 'user@example.com'
    });

    jest.mock('firebase-admin/app', () => ({
      initializeApp: jest.fn().mockReturnValue({ name: 'mock-app' }),
      cert: jest.fn(),
      getApps: jest.fn().mockReturnValue([])
    }));

    jest.mock('firebase-admin/auth', () => ({
      getAuth: jest.fn().mockReturnValue({
        verifyIdToken: mockVerifyIdToken
      })
    }));

    const { verifyFirebaseToken } = require('../config/firebaseAdmin');
    const result = await verifyFirebaseToken('dummy-token');

    expect(result).toEqual({ uid: 'user-abc', email: 'user@example.com' });
    // Must be called with (token, false) — NOT true — when no service account
    expect(mockVerifyIdToken).toHaveBeenCalledWith('dummy-token', false);
  });

  it('calls verifyIdToken with true when service account credentials ARE provided', async () => {
    process.env.FIREBASE_PROJECT_ID = 'travelsync-65565';
    process.env.FIREBASE_CLIENT_EMAIL = 'service-account@travelsync-65565.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nMOCK\\n-----END PRIVATE KEY-----';

    const mockVerifyIdToken = jest.fn().mockResolvedValue({
      uid: 'user-xyz',
      email: 'admin@example.com'
    });

    jest.mock('firebase-admin/app', () => ({
      initializeApp: jest.fn().mockReturnValue({ name: 'mock-app' }),
      cert: jest.fn().mockReturnValue({}),
      getApps: jest.fn().mockReturnValue([])
    }));

    jest.mock('firebase-admin/auth', () => ({
      getAuth: jest.fn().mockReturnValue({
        verifyIdToken: mockVerifyIdToken
      })
    }));

    const { verifyFirebaseToken } = require('../config/firebaseAdmin');
    const result = await verifyFirebaseToken('dummy-token');

    expect(result).toEqual({ uid: 'user-xyz', email: 'admin@example.com' });
    // Must be called with (token, true) when service account is present
    expect(mockVerifyIdToken).toHaveBeenCalledWith('dummy-token', true);
  });
});

