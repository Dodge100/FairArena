import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import logger from '../../../utils/logger.js';

export const GetOrganizationMembers = async (req: Request, res: Response) => {
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

    // Get members for the organization
    const members = await readOnlyPrisma.organizationUserRole.findMany({
      where: {
        organization: { slug },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        role: true,
      },
      orderBy: {
        assignedAt: 'asc',
      },
    });

    const formattedMembers = members.map((member) => ({
      id: member.user.id,
      name: member.user.profile
        ? `${member.user.profile.firstName || ''} ${member.user.profile.lastName || ''}`.trim()
        : member.user.email.split('@')[0], // fallback to email username
      email: member.user.email,
      role: {
        id: member.role.id,
        name: member.role.roleName,
      },
      joinedAt: member.assignedAt,
    }));

    res.json({ members: formattedMembers });
  } catch (error) {
    logger.error('Error fetching organization members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
