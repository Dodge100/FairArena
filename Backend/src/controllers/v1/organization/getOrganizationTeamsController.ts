import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import { redis } from '../../../config/redis.js';
import logger from '../../../utils/logger.js';

const CACHE_TTL = 600;
const CACHE_KEY = (slug: string, userId: string) => `org:${slug}:teams:${userId}`;

export const GetOrganizationTeams = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const { slug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    const cacheKey = CACHE_KEY(slug, userId);

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json(parsed);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for organization teams', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        slug,
        userId,
      });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    // Check if user is a member of the organization
    const userOrganization = await readOnlyPrisma.organizationUserRole.findFirst({
      where: {
        userId,
        organization: { slug },
      },
    });

    if (!userOrganization) {
      return res.status(404).json({ error: 'Organization not found or access denied' });
    }

    // Get teams for the organization
    const teams = await readOnlyPrisma.team.findMany({
      where: {
        organization: { slug },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            teamMemberships: true,
          },
        },
        teamProfile: {
          select: {
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.teamProfile?.description,
      memberCount: team._count.teamMemberships,
      createdAt: team.createdAt,
    }));

    const result = { teams: formattedTeams };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      logger.info('Cached organization teams', { slug, userId, cacheKey, teamCount: teams.length });
    } catch (error) {
      logger.warn('Redis cache write failed for organization teams', { error, slug, userId });
    }

    res.json(result);
  } catch (error) {
    logger.error('Error fetching organization teams:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
