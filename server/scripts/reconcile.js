#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

if (!process.env._DOTENV_LOADED) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  process.env._DOTENV_LOADED = 'true';
}

const { reconcilePendingDeletions } = require('../services/accountDeletionReconciliation');
const { prisma } = require('../db');
const logger = require('../utils/logger');

async function main() {
  logger.info('Starting local account-deletion reconciliation...');
  try {
    const result = await reconcilePendingDeletions({
      prisma,
      olderThanMs: 0
    });
    logger.info(result, 'Account-deletion reconciliation completed.');
  } catch (err) {
    logger.error({ err: err.message }, 'Account-deletion reconciliation encountered an error.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
