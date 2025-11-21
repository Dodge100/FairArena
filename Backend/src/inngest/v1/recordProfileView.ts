import { prisma } from '../../config/database.js';
import { inngest } from './client.js';

export const recordProfileView = inngest.createFunction(
  {
    id: 'record-profile-view',
    name: 'Record Profile View',
  },
  { event: 'profile/view.record' },
  async ({ event, step }) => {
    const { profileId, viewerUserId, viewerEmail, viewerName } = event.data;

    await step.run('record-profile-view', async () => {
      try {
        // Upsert to handle duplicate views
        await prisma.profileView.upsert({
          where: {
            profileId_viewerUserId: {
              profileId,
              viewerUserId,
            },
          },
          update: {
            // Update timestamp if viewing again
            createdAt: new Date(),
          },
          create: {
            profileId,
            viewerUserId,
            viewerEmail,
            viewerName,
          },
        });

        console.log(`Profile view recorded: ${viewerEmail} viewed profile ${profileId}`);
      } catch (error) {
        console.error('Error recording profile view:', error);
        throw error;
      }
    });

    return { success: true };
  },
);
