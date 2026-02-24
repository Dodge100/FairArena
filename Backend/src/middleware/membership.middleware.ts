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

import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

// Extend Express Request to include cached IDs
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      teamId?: string;
    }
  }
}

/**
 * Middleware to verify user is a member of the organization
 * This is a foundational check that must pass before any team operations
 */
export const requireOrganizationMembership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const organizationSlug = req.params.organizationSlug as string;
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Check cache first - stores organization ID to avoid repeated lookups
    const cacheKey = `ORG_MEMBER:${userId}:${organizationSlug}`;
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === 'string') {
      // Store org ID in request for downstream middleware
      req.organizationId = cached;
      return next();
    }

    // Find organization
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug as string },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user is a member
    const membership = await prisma.organizationUserRole.findFirst({
      where: {
        userId,
        organizationId: organization.id,
      },
      select: { id: true },
    });

    if (!membership) {
      logger.warn(
        `Access denied: User ${userId} is not a member of organization ${organizationSlug}`,
      );
      return res.status(403).json({
        error: 'You must be a member of this organization to access teams',
        organizationSlug,
      });
    }

    // Cache organization ID for 1 hour
    await redis.setex(cacheKey, 3600, organization.id);
    req.organizationId = organization.id;

    next();
  } catch (error) {
    logger.error('Error in organization membership middleware:', { error });
    return res.status(500).json({ error: 'Failed to verify organization membership' });
  }
};

/**
 * Middleware to verify user is a member of both organization AND team
 * This ensures hierarchical security: Organization → Team
 */
export const requireTeamMembership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationSlug = req.params.organizationSlug as string;
    const teamSlug = req.params.teamSlug as string;
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Check cache first
    const cacheKey = `TEAM_MEMBER:${userId}:${organizationSlug}:${teamSlug}`;
    const cached = await redis.get(cacheKey);

    if (cached && typeof cached === 'string') {
      req.teamId = cached;
      return next();
    }

    // Try to get organization ID from previous middleware or cache
    let organizationId = req.organizationId;

    if (!organizationId) {
      const orgCacheKey = `ORG_MEMBER:${userId}:${organizationSlug}`;
      const orgCached = await redis.get(orgCacheKey);

      if (orgCached && typeof orgCached === 'string') {
        organizationId = orgCached;
      } else {
        // Fallback to DB query
        const organization = await prisma.organization.findUnique({
          where: { slug: organizationSlug as string },
          select: { id: true },
        });

        if (!organization) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        organizationId = organization.id;

        // Check organization membership
        const orgMembership = await prisma.organizationUserRole.findFirst({
          where: {
            userId,
            organizationId: organization.id,
          },
          select: { id: true },
        });

        if (!orgMembership) {
          logger.warn(
            `Access denied: User ${userId} is not a member of organization ${organizationSlug}`,
          );
          return res.status(403).json({
            error: 'You must be a member of this organization first',
            organizationSlug,
          });
        }

        // Cache org ID
        await redis.setex(orgCacheKey, 3600, organization.id);
      }
    }

    // Find team using organizationId
    const team = await prisma.team.findFirst({
      where: {
        slug: teamSlug as string,
        organizationId,
      },
      select: { id: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check team membership
    const teamMembership = await prisma.teamUserRole.findFirst({
      where: {
        userId,
        teamId: team.id,
      },
      select: { id: true },
    });

    if (!teamMembership) {
      logger.warn(`Access denied: User ${userId} is not a member of team ${teamSlug}`);
      return res.status(403).json({
        error: 'You are not a member of this team',
        teamSlug,
        hint: 'Ask a team admin to invite you',
      });
    }

    // Cache team ID for 1 hour
    await redis.setex(cacheKey, 3600, team.id);
    req.teamId = team.id;

    next();
  } catch (error) {
    logger.error('Error in team membership middleware:', { error });
    return res.status(500).json({ error: 'Failed to verify team membership' });
  }
};

/**
 * Utility to invalidate organization membership cache
 */
export const invalidateOrganizationMembershipCache = async (
  userId: string,
  organizationSlug: string,
) => {
  const cacheKey = `ORG_MEMBER:${userId}:${organizationSlug}`;
  await redis.del(cacheKey);
};

/**
 * Utility to invalidate team membership cache
 */
export const invalidateTeamMembershipCache = async (
  userId: string,
  organizationSlug: string,
  teamSlug: string,
) => {
  const cacheKey = `TEAM_MEMBER:${userId}:${organizationSlug}:${teamSlug}`;
  await redis.del(cacheKey);
};

/**
 * Utility to invalidate all membership caches for a user
 */
export const invalidateAllUserMembershipCaches = async (userId: string) => {
  const orgPattern = `ORG_MEMBER:${userId}:*`;
  const teamPattern = `TEAM_MEMBER:${userId}:*`;

  const orgKeys = await redis.keys(orgPattern);
  const teamKeys = await redis.keys(teamPattern);

  const allKeys = [...orgKeys, ...teamKeys];
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
  }
};
