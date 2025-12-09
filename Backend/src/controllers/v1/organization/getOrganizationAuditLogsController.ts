import { Request, Response } from 'express';
import { redis, REDIS_KEYS } from '../../../config/redis.js';
import logger from '../../../utils/logger.js';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';

interface OrganizationPermissions {
  organization: {
    view: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
    manageBilling: boolean;
    manageSecurity: boolean;
  };
  teams: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageMembers: boolean;
  };
  members: {
    view: boolean;
    invite: boolean;
    remove: boolean;
    manageRoles: boolean;
  };
  projects: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
  };
  roles: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    assign: boolean;
  };
  audit: {
    view: boolean;
  };
}

const CACHE_TTL = 300; // 5 minutes

export const GetOrganizationAuditLogs = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const { slug } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    // Permission check is now handled by middleware
    const organizationContext = (req as any).organizationContext;
    if (!organizationContext) {
      return res.status(500).json({ error: 'Organization context not loaded' });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const cacheKey = `${REDIS_KEYS.USER_ORGANIZATION_AUDIT_LOGS}${organizationContext.organizationId}:${pageNum}:${limitNum}`;

    // Try to get from cache
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData !== null) {
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        logger.info('Serving organization audit logs from cache', {
          organizationId: organizationContext.organizationId,
          userId,
          page: pageNum,
          limit: limitNum
        });
        return res.json(data);
      }
    } catch (cacheError) {
      logger.warn('Redis cache read failed, proceeding with database query', {
        error: (cacheError as Error).message,
        userId,
        organizationId: organizationContext.organizationId,
      });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    // Get audit logs
    const [auditLogs, totalCount] = await Promise.all([
      readOnlyPrisma.organizationAuditLog.findMany({
        where: {
          organizationId: organizationContext.organizationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limitNum,
      }),
      readOnlyPrisma.organizationAuditLog.count({
        where: {
          organizationId: organizationContext.organizationId,
        },
      }),
    ]);

    // Get unique user IDs from audit logs
    const userIds = [...new Set(auditLogs.map((log: any) => log.userId))];

    // Fetch user information for these IDs
    const users = await readOnlyPrisma.user.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      select: {
        userId: true,
        email: true,
      },
    });

    // Create a map of userId to user data
    const userMap = new Map(
      users.map((user: any) => [user.userId, {
        id: user.userId,
        email: user.email,
      }])
    );

    const responseData = {
      auditLogs: auditLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        level: log.level,
        details: null, // OrganizationAuditLog doesn't have details field
        createdAt: log.createdAt,
        user: userMap.get(log.userId) || {
          id: log.userId,
          email: 'Unknown'
        },
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    };

    // Cache the response
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
      logger.info('Cached organization audit logs', {
        organizationId: organizationContext.organizationId,
        userId,
        cacheKey,
        count: auditLogs.length
      });
    } catch (cacheError) {
      logger.warn('Redis cache write failed', {
        error: (cacheError as Error).message,
        userId,
        organizationId: organizationContext.organizationId,
      });
    }

    res.json(responseData);
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching organization audit logs', {
      error: err.message,
      stack: err.stack,
      userId: req.auth()?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
