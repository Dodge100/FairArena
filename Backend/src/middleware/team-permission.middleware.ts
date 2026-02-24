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

import { NextFunction, Request, Response } from 'express';
import { getReadOnlyPrisma } from '../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../config/redis.js';
import logger from '../utils/logger.js';

export interface TeamPermissions {
  team: {
    view: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
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
}

export interface TeamContext {
  teamId: string;
  teamSlug: string;
  organizationId: string;
  organizationSlug: string;
  roleId: string;
  roleName: string;
  permissions: TeamPermissions;
}

// Extend Express Request to include team context
declare global {
  namespace Express {
    interface Request {
      teamContext?: TeamContext;
    }
  }
}

const PERMISSION_CACHE_TTL = 3600; // 1 hour - permissions don't change frequently

/**
 * Middleware to load and cache user's team permissions
 * This prevents repeated DB queries for permission checks
 */
export const teamPermissionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { organizationSlug, teamSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!organizationSlug || !teamSlug) {
      return res.status(400).json({
        error: 'Organization slug and team slug are required',
      });
    }

    const cacheKey = `${REDIS_KEYS.USER_TEAM_CONTEXT}${organizationSlug}:${teamSlug}:${userId}`;

    // Try to get from cache first
    try {
      const cachedPermissions = await redis.get(cacheKey);
      if (cachedPermissions !== null) {
        // Upstash Redis automatically parses JSON
        req.teamContext = cachedPermissions as TeamContext;
        return next();
      }
    } catch (cacheError) {
      logger.warn('Failed to read team permissions from cache', {
        error: (cacheError as Error).message,
        userId,
        organizationSlug,
        teamSlug,
      });
    }

    // Cache miss - fetch from database
    const readOnlyPrisma = getReadOnlyPrisma();

    // First get the organization
    const organization = await readOnlyPrisma.organization.findUnique({
      where: { slug: organizationSlug as string },
      select: { id: true, slug: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get the team
    const team = await readOnlyPrisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: teamSlug as string,
        },
      },
      select: { id: true, slug: true, organizationId: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get user's team role and permissions
    const userTeamRole = await readOnlyPrisma.teamUserRole.findFirst({
      where: {
        userId,
        teamId: team.id,
      },
      include: {
        role: true,
      },
    });

    if (!userTeamRole) {
      return res.status(403).json({
        error: 'You do not have access to this team',
      });
    }

    // Parse permissions safely
    let permissions: TeamPermissions;
    try {
      if (typeof userTeamRole.role.permissions === 'string') {
        permissions = JSON.parse(userTeamRole.role.permissions) as TeamPermissions;
      } else {
        permissions = userTeamRole.role.permissions as unknown as TeamPermissions;
      }
    } catch (parseError) {
      logger.error('Failed to parse team permissions', {
        error: (parseError as Error).message,
        userId,
        teamId: team.id,
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    const teamContext: TeamContext = {
      teamId: team.id,
      teamSlug: team.slug,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      roleId: userTeamRole.roleId,
      roleName: userTeamRole.role.roleName,
      permissions,
    };

    // Cache the permissions
    try {
      await redis.setex(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(teamContext));
    } catch (cacheError) {
      logger.warn('Failed to cache team permissions', {
        error: (cacheError as Error).message,
        userId,
        organizationSlug,
        teamSlug,
      });
    }

    req.teamContext = teamContext;
    next();
  } catch (error) {
    logger.error('Error loading team permissions', {
      error: (error as Error).message,
      userId: req.user?.userId,
      organizationSlug: req.params.organizationSlug,
      teamSlug: req.params.teamSlug,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware factory to check specific team permissions
 * Usage: requireTeamPermission('members', 'invite')
 */
export const requireTeamPermission = (category: keyof TeamPermissions, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.teamContext) {
      return res.status(500).json({ error: 'Team context not loaded' });
    }

    const permissions = req.teamContext.permissions;
    const categoryPermissions = permissions[category] as Record<string, boolean>;

    if (!categoryPermissions || !categoryPermissions[action]) {
      logger.warn('Team permission denied', {
        userId: req.user?.userId,
        teamId: req.teamContext.teamId,
        category,
        action,
        roleName: req.teamContext.roleName,
      });
      return res.status(403).json({
        error: `Insufficient permissions: ${category}.${action} required`,
      });
    }

    next();
  };
};

/**
 * Invalidate permission cache for a user and team
 */
export const invalidateTeamPermissionCache = async (
  userId: string,
  organizationSlug: string,
  teamSlug: string,
) => {
  try {
    const cacheKey = `${REDIS_KEYS.USER_TEAM_CONTEXT}${organizationSlug}:${teamSlug}:${userId}`;
    await redis.del(cacheKey);
    logger.info('Invalidated team permission cache', {
      userId,
      organizationSlug,
      teamSlug,
    });
  } catch (error) {
    logger.warn('Failed to invalidate team permission cache', {
      error: (error as Error).message,
      userId,
      organizationSlug,
      teamSlug,
    });
  }
};

/**
 * Invalidate permission cache for all members of a team
 */
export const invalidateAllTeamPermissionCache = async (teamId: string) => {
  try {
    const readOnlyPrisma = getReadOnlyPrisma();
    const team = await readOnlyPrisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: {
          select: { slug: true },
        },
        teamUserRoles: {
          select: { userId: true },
        },
      },
    });

    if (!team) {
      return;
    }

    const cacheKeys = team.teamUserRoles.map(
      (member) =>
        `${REDIS_KEYS.USER_TEAM_CONTEXT}${team.organization.slug}:${team.slug}:${member.userId}`,
    );

    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
      logger.info('Invalidated team permission caches', {
        teamId,
        count: cacheKeys.length,
      });
    }
  } catch (error) {
    logger.warn('Failed to invalidate team permission caches', {
      error: (error as Error).message,
      teamId,
    });
  }
};
