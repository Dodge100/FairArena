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
