import { Request, Response } from 'express';
import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import logger from '../../../utils/logger.js';

const CACHE_TTL = 600;
const CACHE_KEY = (teamId: string) => `team:roles:${teamId}`;

export const getTeamRoles = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const { teamSlug, organizationSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get team
    const team = await prisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: teamSlug,
        },
      },
      select: { id: true, name: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const cacheKey = CACHE_KEY(team.id);

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json(parsed);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for team roles', { error, teamId: team.id });
    }

    // Check if user has access to this team
    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId,
        teamId: team.id,
      },
    });

    if (!userTeam) {
      return res.status(403).json({ error: 'You do not have access to this team' });
    }

    // Get team roles
    const roles = await prisma.teamRole.findMany({
      where: {
        teamId: team.id,
      },
      select: {
        id: true,
        roleName: true,
        permissions: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const result = { roles };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      logger.warn('Redis cache write failed for team roles', { error, teamId: team.id });
    }

    logger.info('Team roles fetched successfully', {
      teamId: team.id,
      userId,
      roleCount: roles.length,
    });

    res.json(result);
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching team roles', {
      error: err.message,
      stack: err.stack,
      userId: req.auth()?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
