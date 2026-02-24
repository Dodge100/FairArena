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
import { upsertUser } from './userOperations.js';

export const updateUser = inngest.createFunction(
  {
    id: 'update-user',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'user.updated' },
  async ({ event, step }) => {
    const { userId, email, firstName, lastName, profileImageUrl, username } = event.data;

    if (!userId) {
      logger.error('Missing required field userId in user.updated event', { userId, email });
      throw new Error('userId is required');
    }

    logger.info('Starting user update process', { userId, email });

    await step.run('update-user-in-db', async () => {
      try {
        await upsertUser(userId, email, {
          firstName,
          lastName,
          profileImageUrl,
          username,
        });
        logger.info('User updated in database', { userId });
      } catch (error) {
        logger.error('Error updating user in database', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);
