import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const deleteOrganization = inngest.createFunction(
  {
    id: 'delete-organization',
    concurrency: {
      limit: 5,
    },
  },
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

      // Get organization members before deletion for cache invalidation
      const members = await step.run('get-organization-members', async () => {
        const memberList = await readOnlyPrisma.organizationUserRole.findMany({
          where: { organizationId },
          select: { userId: true },
        });

        return memberList;
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

      // Invalidate caches for all former members
      await step.run('invalidate-caches', async () => {
        try {
          // Invalidate organization details cache
          const detailsCacheKeys = members.map(
            (member) =>
              `${REDIS_KEYS.USER_ORGANIZATION_DETAILS}${member.userId}:${organization.slug}`,
          );

          // Invalidate user organizations list cache
          const organizationsCacheKeys = members.map(
            (member) => `${REDIS_KEYS.USER_ORGANIZATIONS}${member.userId}`,
          );

          const allCacheKeys = [...detailsCacheKeys, ...organizationsCacheKeys];

          if (allCacheKeys.length > 0) {
            await redis.del(...allCacheKeys);
            logger.info('Invalidated organization caches after deletion', {
              organizationId,
              memberCount: members.length,
              slug: organization.slug,
              cacheKeysInvalidated: allCacheKeys.length,
            });
          }
        } catch (cacheError) {
          logger.warn('Failed to invalidate organization caches after deletion', {
            cacheError,
            organizationId,
          });
        }
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

      // Create organization audit log (before deletion since organization will be gone)
      await step.run('create-audit-log', async () => {
        await prisma.organizationAuditLog.create({
          data: {
            organizationId,
            action: 'ORGANIZATION_DELETED',
            level: 'WARN',
            userId,
          },
        });

        logger.info('Organization audit log created for deletion', { organizationId, userId });
      });
    } catch (error) {
      logger.error('Error deleting organization:', { error });
      throw error;
    }
  },
);
