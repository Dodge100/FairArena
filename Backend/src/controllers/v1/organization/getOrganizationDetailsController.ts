import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import logger from '../../../utils/logger.js';

export const GetOrganizationDetails = async (req: Request, res: Response) => {
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

    if (!userOrganization) {
      return res.status(404).json({ error: 'Organization not found or access denied' });
    }

    const organization = {
      id: userOrganization.organization.id,
      name: userOrganization.organization.name,
      slug: userOrganization.organization.slug,
      joinEnabled: userOrganization.organization.joinEnabled,
      isPublic: userOrganization.organization.isPublic,
      timezone: userOrganization.organization.timezone,
      createdAt: userOrganization.organization.createdAt,
      memberCount: userOrganization.organization._count.userOrganizations,
      teamCount: userOrganization.organization._count.teams,
      userRole: {
        id: userOrganization.role.id,
        name: userOrganization.role.roleName,
        permissions: userOrganization.role.permissions,
      },
    };

    res.json({ organization });
  } catch (error) {
    logger.error('Error fetching organization details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
