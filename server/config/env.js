const dotenv = require('dotenv');

// Ensure environment variables are loaded once from disk
if (!process.env._DOTENV_LOADED) {
  dotenv.config();
  process.env._DOTENV_LOADED = 'true';
}

function validateEnv(env = process.env) {
  const NODE_ENV = env.NODE_ENV || 'development';
  const isProduction = NODE_ENV.toLowerCase() === 'production';
  const isTest = NODE_ENV.toLowerCase() === 'test';

  const errors = [];

  // 1. DATABASE_URL validation (required in all environments except test)
  const DATABASE_URL = (env.DATABASE_URL || '').trim();
  if (!DATABASE_URL && !isTest) {
    errors.push('DATABASE_URL is missing or empty.');
  }

  // 2. JWT_SECRET validation (min 32 chars)
  const JWT_SECRET = (env.JWT_SECRET || '').trim();
  if (!JWT_SECRET) {
    if (isProduction) {
      errors.push('JWT_SECRET is missing.');
    }
  } else if (JWT_SECRET.length < 32) {
    errors.push(`JWT_SECRET must be at least 32 characters long (currently ${JWT_SECRET.length}).`);
  }

  // 3. REFRESH_SECRET validation (min 32 chars, different from JWT_SECRET)
  const REFRESH_SECRET = (env.REFRESH_SECRET || '').trim();
  if (!REFRESH_SECRET) {
    if (isProduction) {
      errors.push('REFRESH_SECRET is missing.');
    }
  } else if (REFRESH_SECRET.length < 32) {
    errors.push(`REFRESH_SECRET must be at least 32 characters long (currently ${REFRESH_SECRET.length}).`);
  } else if (JWT_SECRET && REFRESH_SECRET === JWT_SECRET) {
    errors.push('REFRESH_SECRET must be different from JWT_SECRET.');
  }

  // 4. ALLOWED_ORIGIN validation
  const ALLOWED_ORIGIN = (env.ALLOWED_ORIGIN || '').trim();
  if (!ALLOWED_ORIGIN && isProduction) {
    errors.push('ALLOWED_ORIGIN is missing or empty.');
  }

  // Optional: DIRECT_URL validation
  const DIRECT_URL = (env.DIRECT_URL || '').trim();

  // Optional: GROQ_API_KEY
  const GROQ_API_KEY = (env.GROQ_API_KEY || '').trim();

  // Optional: UNSPLASH_ACCESS_KEY
  const UNSPLASH_ACCESS_KEY = (env.UNSPLASH_ACCESS_KEY || '').trim();

  // Optional: Email credentials
  const SMTP_USER = (env.SMTP_USER || env.EMAIL_USER || '').trim();
  const SMTP_PASS = (env.SMTP_PASS || env.EMAIL_PASS || '').trim();
  if ((SMTP_USER && !SMTP_PASS) || (!SMTP_USER && SMTP_PASS)) {
    errors.push('Both SMTP_USER/EMAIL_USER and SMTP_PASS/EMAIL_PASS must be provided together.');
  }

  // Optional: NEON_AUTH_JWKS_URL
  const NEON_AUTH_JWKS_URL = (env.NEON_AUTH_JWKS_URL || '').trim();
  if (NEON_AUTH_JWKS_URL) {
    try {
      new URL(NEON_AUTH_JWKS_URL);
    } catch {
      errors.push(`NEON_AUTH_JWKS_URL is not a valid URL: ${NEON_AUTH_JWKS_URL}`);
    }
  }

  // Optional: Firebase credentials
  const FIREBASE_PROJECT_ID = (env.FIREBASE_PROJECT_ID || '').trim();
  const FIREBASE_CLIENT_EMAIL = (env.FIREBASE_CLIENT_EMAIL || '').trim();
  const FIREBASE_PRIVATE_KEY = (env.FIREBASE_PRIVATE_KEY || '').trim();
  const hasSomeFirebase = Boolean(FIREBASE_PROJECT_ID || FIREBASE_CLIENT_EMAIL || FIREBASE_PRIVATE_KEY);
  const hasAllFirebase = Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);
  if (hasSomeFirebase && !hasAllFirebase) {
    errors.push('Firebase configuration incomplete: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be provided together.');
  }

  // Trust proxy configuration
  const rawTrustProxy = env.TRUST_PROXY;
  let TRUST_PROXY = isProduction ? 1 : false;
  if (rawTrustProxy !== undefined && rawTrustProxy !== '') {
    if (rawTrustProxy === 'true' || rawTrustProxy === '1') {
      TRUST_PROXY = 1;
    } else if (rawTrustProxy === 'false' || rawTrustProxy === '0') {
      TRUST_PROXY = false;
    } else if (!isNaN(Number(rawTrustProxy))) {
      TRUST_PROXY = Number(rawTrustProxy);
    } else {
      TRUST_PROXY = rawTrustProxy;
    }
  }

  // In production, exit with a clear message listing what's missing.
  // In development, warn but continue.
  // NOTE: console is used deliberately here — logger.js depends on env.js, so
  //       importing logger would create a circular dependency. This is the one
  //       place in the codebase where console output is intentional.
  /* eslint-disable no-console */
  if (errors.length > 0) {
    if (isProduction) {
      console.error('\n========================================================');
      console.error('❌ [FATAL] Environment Configuration Error(s) in Production:');
      errors.forEach((err, i) => console.error(`   ${i + 1}. ${err}`));
      console.error('Server cannot start safely without required configuration.');
      console.error('========================================================\n');
      process.exit(1);
    } else if (!isTest) {
      console.warn('\n========================================================');
      console.warn('⚠️ [WARN] Environment Variable Warning(s) [Development Mode]:');
      errors.forEach((err, i) => console.warn(`   ${i + 1}. ${err}`));
      console.warn('Continuing execution in development, but please update your .env.');
      console.warn('========================================================\n');
    }
  }
  /* eslint-enable no-console */


  return {
    NODE_ENV,
    isProduction,
    isTest,
    PORT: parseInt(env.PORT, 10) || 3000,
    DATABASE_URL,
    DIRECT_URL,
    JWT_SECRET: JWT_SECRET || (!isProduction ? 'travelsync-dev-insecure-jwt-secret-min-32-chars-long' : ''),
    REFRESH_SECRET: REFRESH_SECRET || (!isProduction ? 'travelsync-dev-insecure-refresh-secret-min-32-chars' : ''),
    ALLOWED_ORIGIN: ALLOWED_ORIGIN || (!isProduction ? 'http://localhost:5173' : ''),
    TRUST_PROXY,
    GROQ_API_KEY,
    UNSPLASH_ACCESS_KEY,
    SMTP_USER,
    SMTP_PASS,
    SMTP_HOST: (env.SMTP_HOST || 'smtp.gmail.com').trim(),
    SMTP_PORT: parseInt(env.SMTP_PORT, 10) || 587,
    SMTP_FROM: (env.SMTP_FROM || '').trim(),
    NEON_AUTH_JWKS_URL,
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    errors
  };
}

const config = validateEnv(process.env);

module.exports = config;
module.exports.config = config;
module.exports.validateEnv = validateEnv;

