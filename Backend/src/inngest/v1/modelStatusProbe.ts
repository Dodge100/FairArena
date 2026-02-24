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

/**
 * AI Gateway — Model Status Probe Cron
 *
 * Runs every 10 minutes to probe each provider and update the Redis status cache.
 * The results are consumed by GET /v1/models/status (public, no auth required).
 */
import { runStatusProbes } from '../../services/v1/modelStatus.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const modelStatusProbe = inngest.createFunction(
  {
    id: 'model-status-probe',
    retries: 0, // Don't retry — next scheduled run will try again
  },
  { cron: '*/10 * * * *' }, // Every 10 minutes
  async () => {
    logger.info('Inngest: model status probe starting');
    try {
      await runStatusProbes();
      logger.info('Inngest: model status probe completed');
      return { success: true };
    } catch (error) {
      logger.error('Inngest: model status probe failed', { error: (error as Error).message });
      // Don't rethrow — we don't want this filling up Dead Letter Queue
      return { success: false, error: (error as Error).message };
    }
  },
);
