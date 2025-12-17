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
