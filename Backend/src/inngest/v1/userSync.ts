import { prisma } from '../../config/database.js';
import { sendWelcomeEmail } from '../../email/index.js';
import { inngest } from './client.js';
import { upsertUser } from './userOperations.js';

export const syncUser = inngest.createFunction(
  { id: 'sync-user' },
  { event: 'user.created' },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    if (!userId || !email) {
      console.error('Missing required fields:', { userId, email });
      throw new Error('userId and email are required');
    }
    await step.run('sync-user-to-db', async () => {
      try {
        await prisma.$transaction(async () => {
          await upsertUser(userId, email);
        });
        console.log(`User ${userId} synced successfully`);
      } catch (error) {
        console.error('Error syncing user:', error);
        throw error;
      }
    });
    await step.run('send-welcome-email', async () => {
      try {
        await sendWelcomeEmail(email, email.split('@')[0]);
        console.log(`Welcome email sent to ${email}`);
      } catch (error) {
        console.error('Error sending welcome email:', error);
      }
    });
  },
);
