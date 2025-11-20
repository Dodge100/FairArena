import { sendWelcomeEmail } from '../../email/v1/index.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { upsertUser } from './userOperations.js';

export const syncUser = inngest.createFunction(
  { id: 'sync-user' },
  { event: 'user.created' },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    if (!userId || !email) {
      logger.error('Missing required fields in user.created event', { userId, email });
      throw new Error('userId and email are required');
    }

    logger.info('Starting user sync process', { userId, email });

    await step.run('sync-user-to-db', async () => {
      try {
        await upsertUser(userId, email);
        logger.info('User synced to database', { userId });
      } catch (error) {
        logger.error('Error syncing user to database', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    await step.run('send-welcome-email', async () => {
      try {
        await sendWelcomeEmail(email, email.split('@')[0]);
        logger.info('Welcome email sent', { email });
      } catch (error) {
        logger.error('Error sending welcome email', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw here to avoid failing the entire function
      }
    });
  },
);
