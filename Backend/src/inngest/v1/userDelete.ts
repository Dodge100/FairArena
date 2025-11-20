import { inngest } from './client.js';
import { deleteUser as deleteUserFromDB } from './userOperations.js';

export const deleteUser = inngest.createFunction(
  { id: 'delete-user' },
  { event: 'user.deleted' },
  async ({ event, step }) => {
    const { userId } = event.data;

    if (!userId) {
      console.error('Missing required field: userId');
      throw new Error('userId is required');
    }

    await step.run('delete-user-from-db', async () => {
      try {
        await deleteUserFromDB(userId);
        console.log(`User ${userId} deleted successfully`);
      } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
      }
    });
  },
);
