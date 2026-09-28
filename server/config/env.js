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

  // 1. DATABASE_URL validation
  const DATABASE_URL = (env.DATABASE_URL || '').trim();
  if (!DATABASE_URL) {
    errors.push('DATABASE_URL is missing or empty.');
  }

  // 2. JWT_SECRET validation (min 32 chars)
  const JWT_SECRET = (env.JWT_SECRET || '').trim();
  if (!JWT_SECRET) {
    errors.push('JWT_SECRET is missing.');
  } else if (JWT_SECRET.length < 32) {
    errors.push(`JWT_SECRET must be at least 32 characters long (currently ${JWT_SECRET.length}).`);
  }

  // 3. REFRESH_SECRET validation (min 32 chars, different from JWT_SECRET)
  const REFRESH_SECRET = (env.REFRESH_SECRET || '').trim();
  if (!REFRESH_SECRET) {
    errors.push('REFRESH_SECRET is missing.');
  } else if (REFRESH_SECRET.length < 32) {
    errors.push(`REFRESH_SECRET must be at least 32 characters long (currently ${REFRESH_SECRET.length}).`);
  } else if (JWT_SECRET && REFRESH_SECRET === JWT_SECRET) {
    errors.push('REFRESH_SECRET must be different from JWT_SECRET.');
  }

  // 4. ALLOWED_ORIGIN validation
  const ALLOWED_ORIGIN = (env.ALLOWED_ORIGIN || '').trim();
  if (!ALLOWED_ORIGIN) {
    errors.push('ALLOWED_ORIGIN is missing or empty.');
  }

  // In production, exit with a clear message listing what's missing.
  // In development, warn but continue.
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

  return {
    NODE_ENV,
    isProduction,
    isTest,
    PORT: parseInt(env.PORT, 10) || 3000,
    DATABASE_URL,
    JWT_SECRET: JWT_SECRET || (!isProduction ? 'travelsync-dev-insecure-jwt-secret-min-32-chars-long' : ''),
    REFRESH_SECRET: REFRESH_SECRET || (!isProduction ? 'travelsync-dev-insecure-refresh-secret-min-32-chars' : ''),
    ALLOWED_ORIGIN: ALLOWED_ORIGIN || (!isProduction ? 'http://localhost:5173' : ''),
    GROQ_API_KEY: (env.GROQ_API_KEY || '').trim(),
    UNSPLASH_ACCESS_KEY: (env.UNSPLASH_ACCESS_KEY || '').trim(),
    SMTP_EMAIL: (env.SMTP_EMAIL || env.SMTP_USER || '').trim(),
    SMTP_PASSWORD: (env.SMTP_PASSWORD || env.SMTP_PASS || '').trim(),
    errors
  };
}

const config = validateEnv(process.env);

module.exports = config;
module.exports.config = config;
module.exports.validateEnv = validateEnv;
