import { Request, Response } from 'express';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

interface OrganizationPermissions {
  organization: {
    view: boolean;
    edit: boolean;
    delete: boolean;
    manageSettings: boolean;
    manageBilling: boolean;
    manageSecurity: boolean;
  };
  teams: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    manageMembers: boolean;
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
  roles: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    assign: boolean;
  };
  audit: {
    view: boolean;
  };
}

export const DeleteOrganization = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { slug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    // Permission check is now handled by middleware
    // Get organization context from middleware
    const organizationContext = (req as any).organizationContext;
    if (!organizationContext) {
      return res.status(500).json({ error: 'Organization context not loaded' });
    }

    const organizationId = organizationContext.organizationId;
    const organizationName = organizationContext.organizationSlug;

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
