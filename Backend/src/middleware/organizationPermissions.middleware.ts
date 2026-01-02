import { NextFunction, Request, Response } from 'express';
import { getReadOnlyPrisma } from '../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../config/redis.js';
import logger from '../utils/logger.js';

export interface OrganizationPermissions {
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

export interface OrganizationContext {
  organizationId: string;
  organizationSlug: string;
  roleId: string;
  roleName: string;
  permissions: OrganizationPermissions;
}

// Extend Express Request to include organization context
declare global {
  namespace Express {
    interface Request {
      organizationContext?: OrganizationContext;
    }
  }
}

const PERMISSION_CACHE_TTL = 3600; // 1 hour - permissions don't change frequently

/**
 * Middleware to load and cache user's organization permissions
 * This prevents repeated DB queries for permission checks
 */
export const loadOrganizationPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { organizationSlug, slug } = req.params;
    const orgSlug = organizationSlug || slug;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!orgSlug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    const cacheKey = `${REDIS_KEYS.USER_ORGANIZATION_PERMISSIONS}${userId}:${orgSlug}`;

    // Try to get from cache first
    try {
      const cachedPermissions = await redis.get(cacheKey);
      if (cachedPermissions !== null) {
        // Upstash Redis automatically parses JSON
        req.organizationContext = cachedPermissions as OrganizationContext;
        logger.debug('Loaded organization permissions from cache', { userId, orgSlug });
        return next();
      }
    } catch (cacheError) {
      logger.warn('Failed to read permissions from cache', {
        error: (cacheError as Error).message,
        userId,
        orgSlug,
      });
    }

    // Cache miss - fetch from database
    const readOnlyPrisma = getReadOnlyPrisma();
    const userOrganization = await readOnlyPrisma.organizationUserRole.findFirst({
      where: {
        userId,
        organization: { slug: orgSlug },
      },
      include: {
        role: true,
        organization: {
          select: {
            id: true,
            slug: true,
          },
        },
      },
    });

    if (!userOrganization) {
      return res.status(404).json({ error: 'Organization not found or access denied' });
    }

    // Parse permissions safely
    let permissions: OrganizationPermissions;
    try {
      if (typeof userOrganization.role.permissions === 'string') {
        permissions = JSON.parse(userOrganization.role.permissions) as OrganizationPermissions;
      } else {
        permissions = userOrganization.role.permissions as unknown as OrganizationPermissions;
      }
    } catch (parseError) {
      logger.error('Failed to parse organization permissions', {
        error: (parseError as Error).message,
        userId,
        organizationId: userOrganization.organizationId,
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    const organizationContext: OrganizationContext = {
      organizationId: userOrganization.organizationId,
      organizationSlug: userOrganization.organization.slug,
      roleId: userOrganization.roleId,
      roleName: userOrganization.role.roleName,
      permissions,
    };

    // Cache the permissions
    try {
      await redis.setex(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(organizationContext));
      logger.debug('Cached organization permissions', { userId, orgSlug, cacheKey });
    } catch (cacheError) {
      logger.warn('Failed to cache permissions', {
        error: (cacheError as Error).message,
        userId,
        orgSlug,
      });
    }

    req.organizationContext = organizationContext;
    next();
  } catch (error) {
    logger.error('Error loading organization permissions', {
      error: (error as Error).message,
      userId: req.user?.userId,
      orgSlug: req.params.organizationSlug || req.params.slug,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware factory to check specific permissions
 * Usage: requirePermission('organization', 'edit')
 */
export const requirePermission = (category: keyof OrganizationPermissions, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organizationContext) {
      return res.status(500).json({ error: 'Organization context not loaded' });
    }

    const permissions = req.organizationContext.permissions;
    const categoryPermissions = permissions[category] as Record<string, boolean>;

    if (!categoryPermissions || !categoryPermissions[action]) {
      logger.warn('Permission denied', {
        userId: req.user?.userId,
        organizationId: req.organizationContext.organizationId,
        category,
        action,
        roleName: req.organizationContext.roleName,
      });
      return res.status(403).json({
        error: `Insufficient permissions: ${category}.${action} required`,
      });
    }

    next();
  };
};

/**
 * Invalidate permission cache for a user and organization
 */
export const invalidatePermissionCache = async (userId: string, slug: string) => {
  try {
    const cacheKey = `${REDIS_KEYS.USER_ORGANIZATION_PERMISSIONS}${userId}:${slug}`;
    await redis.del(cacheKey);
    logger.info('Invalidated permission cache', { userId, slug });
  } catch (error) {
    logger.warn('Failed to invalidate permission cache', {
      error: (error as Error).message,
      userId,
      slug,
    });
  }
};

/**
 * Invalidate permission cache for all members of an organization
 */
export const invalidateOrganizationPermissionCache = async (organizationId: string) => {
  try {
    const readOnlyPrisma = getReadOnlyPrisma();
    const members = await readOnlyPrisma.organizationUserRole.findMany({
      where: { organizationId },
      include: {
        organization: {
          select: { slug: true },
        },
      },
    });

    const cacheKeys = members.map(
      (member) =>
        `${REDIS_KEYS.USER_ORGANIZATION_PERMISSIONS}${member.userId}:${member.organization.slug}`,
    );

    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
      logger.info('Invalidated organization permission caches', {
        organizationId,
        count: cacheKeys.length,
      });
    }
  } catch (error) {
    logger.warn('Failed to invalidate organization permission caches', {
      error: (error as Error).message,
      organizationId,
    });
  }
};
