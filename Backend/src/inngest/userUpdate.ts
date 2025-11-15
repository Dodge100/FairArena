import { prisma } from '../config/database.js';
import { inngest } from './client.js';
import { upsertUser } from './userOperations.js';

export const updateUser = inngest.createFunction(
  { id: 'update-user' },
  { event: 'user.updated' },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    if (!userId || !email) {
      console.error('Missing required fields:', { userId, email });
      throw new Error('userId and email are required');
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
