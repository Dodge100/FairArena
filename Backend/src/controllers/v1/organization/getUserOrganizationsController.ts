import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import logger from '../../../utils/logger.js';

export const GetUserOrganizations = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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

    res.json({ organizations });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching user organizations', {
      error: err.message,
      stack: err.stack,
      userId: req.auth()?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
