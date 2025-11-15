import { prisma } from '../config/database.js';
import { inngest } from './client.js';

export const syncUser = inngest.createFunction(
  { id: 'sync-user' },
  { event: 'user.created' },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    await step.run('sync-user-to-db', async () => {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.upsert({
            where: { userId },
            update: { email },
            create: { userId, email },
          });
        });
        console.log(`User ${userId} synced successfully`);
      } catch (error) {
        console.error('Error syncing user:', error);
        throw error;
      }
    });
  },
);
