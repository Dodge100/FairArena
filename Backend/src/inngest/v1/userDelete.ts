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

import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { deleteUser as deleteUserFromDB } from './userOperations.js';

export const deleteUser = inngest.createFunction(
  {
    id: 'delete-user',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'user.deleted' },
  async ({ event, step }) => {
    const { userId } = event.data;

    if (!userId) {
      logger.error('Missing required field: userId in user.deleted event');
      throw new Error('userId is required');
    }
    logger.info('Starting user deletion process', { userId });

    await step.run('delete-user-from-db', async () => {
      try {
        await deleteUserFromDB(userId);
        logger.info('User deletion completed', { userId });
      } catch (error) {
        logger.error('Error in user deletion step', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);
