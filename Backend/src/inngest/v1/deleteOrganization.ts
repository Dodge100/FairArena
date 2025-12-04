import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

export const deleteOrganization = inngest.createFunction(
  { id: 'delete-organization' },
  { event: 'organization.delete' },
  async ({ event, step }) => {
    const { organizationId, userId, organizationName } = event.data;
    const readOnlyPrisma = getReadOnlyPrisma();

    if (!organizationId || !userId) {
      logger.error('Missing required fields in organization.delete event', {
        organizationId,
        userId,
      });
      throw new Error('organizationId and userId are required');
    }

    logger.info('Starting organization deletion', { organizationId, userId, organizationName });

    try {
      // Get organization details before deletion for logging
      const organization = await step.run('get-organization-details', async () => {
        const org = await readOnlyPrisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: {
                userOrganizations: true,
                teams: true,
              },
            },
          },
        });

        if (!org) {
          throw new Error('Organization not found');
        }

        return org;
      });

      // Delete the organization (cascade will handle related records)
      await step.run('delete-organization', async () => {
        await prisma.organization.delete({
          where: { id: organizationId },
        });

        logger.info('Organization deleted successfully', {
          organizationId,
          name: organization.name,
          memberCount: organization._count.userOrganizations,
          teamCount: organization._count.teams,
        });
      });

      // Create log entry
      await step.run('create-log', async () => {
        await prisma.logs.create({
          data: {
            userId,
            action: 'organization_deleted',
            level: 'WARN',
            metadata: {
              organizationId,
              organizationName: organization.name,
              memberCount: organization._count.userOrganizations,
              teamCount: organization._count.teams,
              deletedBy: userId,
            },
          },
        });

        logger.info('Organization deletion log created', { organizationId, userId });
      });
    } catch (error) {
      logger.error('Error deleting organization:', {error});
      throw error;
    }
  },
);
