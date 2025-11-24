import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import logger from '../../../utils/logger.js';

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
      include: {
        _count: {
          select: {
            teamMemberships: true,
          },
        },
        teamProfile: true,
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

    res.json({ teams: formattedTeams });
  } catch (error) {
    logger.error('Error fetching organization teams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
