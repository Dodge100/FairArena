/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

async function clearRedis() {
  try {
    logger.info('Starting Redis cleanup...');

    // Get all keys (be careful with this in production with large datasets)
    const keys = await redis.keys('*');

    if (keys.length === 0) {
      logger.info('No keys found in Redis. Database is already empty.');
      return;
    }

    logger.info(`Found ${keys.length} keys in Redis. Deleting...`);

    // Delete all keys
    let deletedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(batch.map((key) => redis.del(key)));
      deletedCount += batch.length;

      if (deletedCount % 500 === 0 || deletedCount === keys.length) {
        logger.info(`Deleted ${deletedCount}/${keys.length} keys...`);
      }
    }

    logger.info(`✅ Successfully cleared ${deletedCount} keys from Redis`);
    logger.info('Redis database is now empty.');
  } catch (error) {
    logger.error('Failed to clear Redis', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the script
clearRedis()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed', { error });
    process.exit(1);
  });
