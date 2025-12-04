import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

interface UpdateOrganizationSettingsRequest {
  name?: string;
  isPublic?: boolean;
  joinEnabled?: boolean;
}

export const UpdateOrganizationSettings = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const { slug } = req.params;
    const { name, isPublic, joinEnabled }: UpdateOrganizationSettingsRequest = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    // Check if user has permission to edit the organization
    const userOrganization = await readOnlyPrisma.organizationUserRole.findFirst({
      where: {
        userId,
        organization: { slug },
      },
      include: {
        role: true,
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
      },
    });

    if (!userOrganization) {
      return res.status(404).json({ error: 'Organization not found or access denied' });
    }

    // Check if user has edit permissions
    const permissions = userOrganization.role.permissions as Record<string, boolean>;
    const canEdit = permissions?.canEditSettings;

    if (!canEdit) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to edit organization settings' });
    }

    // Validate input
    if (
      name !== undefined &&
      (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)
    ) {
      return res.status(400).json({ error: 'Invalid organization name' });
    }

    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'Invalid public setting' });
    }

    if (joinEnabled !== undefined && typeof joinEnabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid join enabled setting' });
    }

    // Check if name is already taken (if being updated)
    if (name !== undefined) {
      const existingOrg = await readOnlyPrisma.organization.findFirst({
        where: {
          name: name.trim(),
          id: { not: userOrganization.organizationId },
        },
      });

      if (existingOrg) {
        return res.status(409).json({ error: 'Organization name already exists' });
      }
    }

    // Prepare update data
    const updateData: { name?: string; isPublic?: boolean; joinEnabled?: boolean } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (joinEnabled !== undefined) updateData.joinEnabled = joinEnabled;

    // Send to Inngest for async processing
    await inngest.send({
      name: 'organization.update',
      data: {
        organizationId: userOrganization.organizationId,
        userId,
        updateData,
      },
    });

    logger.info(`Organization update queued: ${userOrganization.organizationId} by user ${userId}`);

    // Return immediate response with current organization data
    res.status(202).json({
      message: 'Organization settings update has been queued and will be processed shortly',
      organization: {
        id: userOrganization.organization.id,
        name: userOrganization.organization.name,
        slug: userOrganization.organization.slug,
        joinEnabled: userOrganization.organization.joinEnabled,
        isPublic: userOrganization.organization.isPublic,
        timezone: userOrganization.organization.timezone,
        createdAt: userOrganization.organization.createdAt,
        memberCount: userOrganization.organization._count?.userOrganizations || 0,
        teamCount: userOrganization.organization._count?.teams || 0,
      },
    });
  } catch (error) {
    logger.error('Error queuing organization settings update:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
