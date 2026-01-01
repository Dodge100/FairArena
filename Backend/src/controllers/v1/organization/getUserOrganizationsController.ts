import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../../config/redis.js';
import logger from '../../../utils/logger.js';

const CACHE_TTL = 3600;

export const GetUserOrganizations = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cacheKey = `${REDIS_KEYS.USER_ORGANIZATIONS}${userId}`;

    // Try to get from cache
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData !== null) {
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        logger.info('Serving user organizations from cache', { userId });
        return res.json(data);
      } else {
        logger.info('Cache miss for user organizations', { userId, cacheKey });
      }
    } catch (cacheError) {
      logger.warn('Redis cache read failed, proceeding with database query', {
        error: (cacheError as Error).message,
        userId,
      });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    const userOrganizations = await readOnlyPrisma.organizationUserRole.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                userOrganizations: true,
                teams: true,
              },
            },
          },
        },
        role: true,
      },
    });

    const organizations = userOrganizations.map((uo) => ({
      id: uo.organization.id,
      name: uo.organization.name,
      slug: uo.organization.slug,
      joinEnabled: uo.organization.joinEnabled,
      isPublic: uo.organization.isPublic,
      timezone: uo.organization.timezone,
      createdAt: uo.organization.createdAt,
      memberCount: uo.organization._count.userOrganizations,
      teamCount: uo.organization._count.teams,
      userRole: {
        id: uo.role.id,
        name: uo.role.roleName,
        permissions: uo.role.permissions,
      },
    }));

    const responseData = { organizations };

    // Cache the response
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
      logger.info('Cached user organizations', { userId, cacheKey });
    } catch (cacheError) {
      logger.warn('Redis cache write failed', {
        error: (cacheError as Error).message,
        userId,
      });
    }

    res.json(responseData);
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching user organizations', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
