import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { invalidateOrganizationPermissionCache } from '../../middleware/organizationPermissions.middleware.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const updateOrganization = inngest.createFunction(
  {
    id: 'update-organization',
    concurrency: {
      limit: 5,
    },
  },
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
      // Get the original organization data before update (needed for cache invalidation)
      const originalOrganization = await step.run('get-original-organization', async () => {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { slug: true },
        });

        if (!org) {
          throw new Error(`Organization with id ${organizationId} not found`);
        }

        return org;
      });

      // Update the organization
      await step.run('update-organization', async () => {
        await prisma.organization.update({
          where: { id: organizationId },
          data: updateData,
        });

        logger.info('Organization updated successfully', { organizationId });
      });

      // Invalidate organization details cache for all members using the original slug
      await step.run('invalidate-cache', async () => {
        try {
          const members = await prisma.organizationUserRole.findMany({
            where: { organizationId },
            select: { userId: true },
          });

          // Invalidate organization details cache
          const detailsCacheKeys = members.map(
            (member) =>
              `${REDIS_KEYS.USER_ORGANIZATION_DETAILS}${member.userId}:${originalOrganization.slug}`,
          );

          // Invalidate user organizations list cache
          const organizationsCacheKeys = members.map(
            (member) => `${REDIS_KEYS.USER_ORGANIZATIONS}${member.userId}`,
          );

          const allCacheKeys = [...detailsCacheKeys, ...organizationsCacheKeys];

          if (allCacheKeys.length > 0) {
            await redis.del(...allCacheKeys);
            logger.info('Invalidated organization caches', {
              organizationId,
              memberCount: members.length,
              originalSlug: originalOrganization.slug,
              cacheKeysInvalidated: allCacheKeys.length,
            });
          }
        } catch (cacheError) {
          logger.warn('Failed to invalidate organization caches', {
            cacheError,
            organizationId,
          });
        }
      });

      // Invalidate permission caches for all members
      await step.run('invalidate-permission-cache', async () => {
        await invalidateOrganizationPermissionCache(organizationId);
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

      // Create organization audit log
      await step.run('create-audit-log', async () => {
        await prisma.organizationAuditLog.create({
          data: {
            organizationId,
            action: 'ORGANIZATION_SETTINGS_UPDATED',
            level: 'INFO',
            userId,
          },
        });

        logger.info('Organization audit log created for settings update', {
          organizationId,
          userId,
        });
      });
    } catch (error) {
      logger.error('Failed to update organization', {
        error,
        organizationId,
        userId,
        updateData,
      });
      throw error;
    }
  },
);
