// Firebase Admin SDK — server-side token verification
// Credentials come from environment variables ONLY.
// Never commit a service-account JSON file; never use VITE_* variables here.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const config = require('./env');
const logger = require('../utils/logger');

let adminApp;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const projectId = config.FIREBASE_PROJECT_ID;
  const clientEmail = config.FIREBASE_CLIENT_EMAIL;
  // Render / env files store multi-line private keys with literal \n — replace them back
  const privateKey = (config.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    if (!config.isTest) {
      logger.info(
        `[Firebase Admin] Initialized for project "${projectId || 'travelsync-dev'}" (cryptographic public-key verification mode).`
      );
    }
    if (projectId && !process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }
    // Initialize with projectId so Firebase Admin can verify JWTs using Google's public x509 certs
    adminApp = initializeApp({ projectId: projectId || 'travelsync-dev' });
  } else {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
  }

  return adminApp;
}

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Throws if the token is missing, malformed, expired, or revoked.
 *
 * Note: checkRevoked is only passed as true when service-account credentials
 * (FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY) are configured. When running
 * in public-key verification mode (FIREBASE_PROJECT_ID only), verifyIdToken
 * cryptographically validates the token's RSA256 signature, expiration, issuer,
 * and audience against Google's public certificates without calling Google Admin APIs.
 *
 * @param {string} idToken - Raw token from the Authorization header
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>}
 */
async function verifyFirebaseToken(idToken) {
  const app = getAdminApp();
  const hasServiceAccount = Boolean(
    config.FIREBASE_PROJECT_ID &&
    config.FIREBASE_CLIENT_EMAIL &&
    config.FIREBASE_PRIVATE_KEY
  );
  return getAuth(app).verifyIdToken(idToken, hasServiceAccount);
}

module.exports = { verifyFirebaseToken, getAdminApp };
