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

import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

interface LogEventData {
  userId: string;
  action: string;
  level: 'INFO' | 'WARN' | 'CRITICAL';
  metadata?: Record<string, unknown>;
}

/**
 * Inngest function to create logs asynchronously
 * Decouples logging from main application flow
 */
export const createLog = inngest.createFunction(
  {
    id: 'create-log',
    concurrency: {
      limit: 5,
    },
    retries: 3, // Retry up to 3 times on failure
  },
  { event: 'log.create' },
  async ({ event, step }) => {
    const { userId, action, level, metadata } = event.data as LogEventData;

    if (!userId || !action || !level) {
      logger.error('Missing required fields in log.create event', { userId, action, level });
      throw new Error('userId, action, and level are required');
    }

    logger.info('Creating log entry', { userId, action, level });

    await step.run('create-log-entry', async () => {
      try {
        await prisma.logs.create({
          data: {
            userId,
            action,
            level,
            // @ts-ignore
            metadata: metadata || {},
          },
        });

        logger.info('Log entry created successfully', { userId, action, level });
      } catch (error) {
        logger.error('Failed to create log entry', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          action,
          level,
        });
        throw error;
      }
    });
  },
);
