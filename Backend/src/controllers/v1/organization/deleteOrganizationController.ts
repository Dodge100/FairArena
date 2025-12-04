import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

export const DeleteOrganization = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const { slug } = req.params;
    const readOnlyPrisma = getReadOnlyPrisma();

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    // Check if user is the owner of the organization
    const userOrganization = await readOnlyPrisma.organizationUserRole.findFirst({
      where: {
        userId,
        organization: { slug },
      },
      include: {
        role: true,
        organization: true,
      },
    });

    if (!userOrganization) {
      return res.status(404).json({ error: 'Organization not found or access denied' });
    }

    // Only owners can delete organizations
    if (userOrganization.role.roleName.toLowerCase() !== 'owner') {
      return res.status(403).json({ error: 'Only organization owners can delete organizations' });
    }

    const organizationId = userOrganization.organizationId;
    const organizationName = userOrganization.organization.name;

    // Send to Inngest for async processing
    await inngest.send({
      name: 'organization.delete',
      data: {
        organizationId,
        userId,
        organizationName,
      },
    });

    logger.info(
      `Organization deletion queued: ${organizationId} (${organizationName}) by user ${userId}`,
    );

    // Return immediate response
    res.status(202).json({
      message: 'Organization deletion has been queued and will be processed shortly',
      organization: {
        id: organizationId,
        name: organizationName,
      },
    });
  } catch (error) {
    logger.error('Error queuing organization deletion:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
