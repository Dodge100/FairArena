/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const createOrganizationAuditLog = inngest.createFunction(
  {
    id: 'create-organization-audit-log',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'organization.audit.create' },
  async ({ event, step }) => {
    const { organizationId, action, level, userId, metadata } = event.data;

    if (!organizationId || !action || !level || !userId) {
      logger.error('Missing required fields in organization.audit.create event', {
        organizationId,
        action,
        level,
        userId,
        metadata,
      });
      throw new Error('organizationId, action, level, and userId are required');
    }

    logger.info('Creating organization audit log', { organizationId, action, level, userId });

    try {
      await step.run('create-audit-log', async () => {
        await prisma.organizationAuditLog.create({
          data: {
            organizationId,
            action,
            level,
            userId,
          },
        });

        logger.info('Organization audit log created', { organizationId, action, userId });
      });

      // Invalidate audit log caches for this organization
      await step.run('invalidate-audit-cache', async () => {
        try {
          const pattern = `${REDIS_KEYS.USER_ORGANIZATION_AUDIT_LOGS}${organizationId}:*`;
          const keys = await redis.keys(pattern);

          if (keys.length > 0) {
            await redis.del(...keys);
            logger.info('Invalidated audit log caches', {
              organizationId,
              keysInvalidated: keys.length,
            });
          }
        } catch (cacheError) {
          logger.warn('Failed to invalidate audit log caches', { cacheError, organizationId });
        }
      });
    } catch (error) {
      logger.error('Error creating organization audit log:', {
        error,
        organizationId,
        action,
        userId,
      });
      throw error;
    }
  },
);
