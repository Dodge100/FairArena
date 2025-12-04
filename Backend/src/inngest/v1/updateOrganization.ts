import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const updateOrganization = inngest.createFunction(
  { id: 'update-organization' },
  { event: 'organization.update' },
  async ({ event, step }) => {
    const { organizationId, userId, updateData } = event.data;

    if (!organizationId || !userId || !updateData) {
      logger.error('Missing required fields in organization.update event', {
        organizationId,
        userId,
        updateData,
      });
      throw new Error('organizationId, userId, and updateData are required');
    }

    logger.info('Starting organization update', { organizationId, userId, updateData });

    try {
      // Update the organization
      await step.run('update-organization', async () => {
        const updatedOrganization = await prisma.organization.update({
          where: { id: organizationId },
          data: updateData,
        });

        logger.info('Organization updated successfully', {
          organizationId: updatedOrganization.id,
          name: updatedOrganization.name,
        });

        return updatedOrganization;
      });

      // Create log entry
      await step.run('create-log', async () => {
        await prisma.logs.create({
          data: {
            userId,
            action: 'organization_settings_updated',
            level: 'INFO',
            metadata: {
              organizationId,
              changes: updateData,
            },
          },
        });

        logger.info('Organization update log created', { organizationId, userId });
      });
    } catch (error) {
      logger.error('Error updating organization:', {error});
      throw error;
    }
  },
);
