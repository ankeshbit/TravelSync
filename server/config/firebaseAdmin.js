// Firebase Admin SDK — server-side token verification
// Credentials come from environment variables ONLY.
// Never commit a service-account JSON file; never use VITE_* variables here.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let adminApp;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Render / env files store multi-line private keys with literal \n — replace them back
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '⚠ Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY ' +
        'must all be set. Firebase token verification will fail until they are configured.'
      );
    }
    // Initialize without credentials so the server can still boot in development
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
 * @param {string} idToken - Raw token from the Authorization header
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>}
 */
async function verifyFirebaseToken(idToken) {
  const app = getAdminApp();
  return getAuth(app).verifyIdToken(idToken);
}

module.exports = { verifyFirebaseToken, getAdminApp };
