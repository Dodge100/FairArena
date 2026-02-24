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

import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../../config/read-only.database.js';
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

interface UpdateOrganizationSettingsRequest {
  name?: string;
  isPublic?: boolean;
  joinEnabled?: boolean;
}

export const UpdateOrganizationSettings = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { slug } = req.params;
    const { name, isPublic, joinEnabled }: UpdateOrganizationSettingsRequest = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!slug) {
      return res.status(400).json({ error: 'Organization slug is required' });
    }

    // Permission check is now handled by middleware
    const organizationContext = (req as any).organizationContext;
    if (!organizationContext) {
      return res.status(500).json({ error: 'Organization context not loaded' });
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
      const readOnlyPrisma = getReadOnlyPrisma();
      const existingOrg = await readOnlyPrisma.organization.findFirst({
        where: {
          name: name.trim(),
          id: { not: organizationContext.organizationId },
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
        organizationId: organizationContext.organizationId,
        userId,
        updateData,
      },
    });

    logger.info(
      `Organization update queued: ${organizationContext.organizationId} by user ${userId}`,
    );

    // Return immediate response
    res.status(202).json({
      message: 'Organization settings update has been queued and will be processed shortly',
      organizationId: organizationContext.organizationId,
    });
  } catch (error) {
    logger.error('Error queuing organization settings update:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
