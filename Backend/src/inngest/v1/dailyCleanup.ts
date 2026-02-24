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

import { performCleanup } from '../../controllers/v1/cleanupController.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const dailyCleanup = inngest.createFunction(
  {
    id: 'daily-cleanup',
  },
  { cron: '0 6 * * *' }, // Every day at 6 AM
  async () => {
    logger.info('Starting daily cleanup job');

    try {
      const result = await performCleanup();
      logger.info('Daily cleanup completed successfully', result);
      return result;
    } catch (error) {
      logger.error('Daily cleanup failed', { error });
      throw error;
    }
  },
);
