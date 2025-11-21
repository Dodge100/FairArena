import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { deleteUser as deleteUserFromDB } from './userOperations.js';

export const deleteUser = inngest.createFunction(
  { id: 'delete-user' },
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
