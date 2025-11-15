import { prisma } from '../../config/database.js';
import { inngest } from './client.js';
import { upsertUser } from './userOperations.js';

export const updateUser = inngest.createFunction(
  { id: 'update-user' },
  { event: 'user.updated' },
  async ({ event, step }) => {
    console.log('updateUser function called with event:', event);

    const { userId, email } = event.data;

    if (!userId) {
      console.error('Missing required fields:', { userId, email });
      throw new Error('userId is required');
    }
    await step.run('update-user-in-db', async () => {
      try {
        await prisma.$transaction(async () => {
          await upsertUser(userId, email);
        });
        console.log(`User ${userId} updated successfully`);
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    });
  },
);
