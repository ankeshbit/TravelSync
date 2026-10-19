#!/usr/bin/env node
/**
 * Migration Runner Script for TravelSync.
 *
 * Pre-validates database configuration before executing Prisma migrations:
 * - Ensures DATABASE_URL is present.
 * - Ensures DIRECT_URL is configured when DATABASE_URL uses a connection pooler (e.g. Neon).
 * - Transparently defaults DIRECT_URL to DATABASE_URL in direct/non-pooled environments.
 * - Prevents credential exposure in logs and error messages.
 */

const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Ensure environment variables are loaded once from disk if available
if (!process.env._DOTENV_LOADED) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  process.env._DOTENV_LOADED = 'true';
}

const { validateMigrationEnv } = require('../config/env');

function run() {
  const validation = validateMigrationEnv(process.env);

  if (!validation.valid) {
    /* eslint-disable no-console */
    console.error('\n========================================================');
    console.error('❌ [FATAL] Database Migration Configuration Error:');
    validation.errors.forEach((err, i) => console.error(`   ${i + 1}. ${err}`));
    console.error('========================================================\n');
    /* eslint-enable no-console */
    process.exit(1);
  }

  // Ensure DIRECT_URL is set in environment for Prisma CLI (directUrl in schema.prisma)
  process.env.DIRECT_URL = validation.effectiveDirectUrl;

  const action = (process.argv[2] || 'deploy').toLowerCase();
  let prismaCmd;

  switch (action) {
  case 'status':
    prismaCmd = 'npx prisma migrate status';
    break;
  case 'push':
    prismaCmd = 'npx prisma db push';
    break;
  case 'deploy':
  default:
    prismaCmd = 'npx prisma migrate deploy';
    break;
  }

  try {
    execSync(prismaCmd, {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..')
    });
  } catch (err) {
    if (action === 'status') {
      // Prisma migrate status exits with code 1 when unapplied migrations exist
      process.exit(err.status ?? 0);
    }
    /* eslint-disable no-console */
    console.error(`\n❌ Migration failed during '${prismaCmd}'. See output above.`);
    /* eslint-enable no-console */
    process.exit(err.status || 1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
