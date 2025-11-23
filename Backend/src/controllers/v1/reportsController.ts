import { Request, Response } from 'express';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

interface CreateReportRequest {
  reportedEntityId: string;
  entityType: string;
  reason: string;
  details?: string;
}

export const CreateReport = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reportedEntityId, entityType, reason, details }: CreateReportRequest = req.body;

    // Validate required fields
    if (!reportedEntityId || !entityType || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate entity type
    const validEntityTypes = ['profile', 'organization', 'team', 'project'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Validate reason
    const validReasons = ['spam', 'harassment', 'inappropriate', 'fake', 'privacy', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' });
    }

    // Validate details length if provided
    if (details && details.length > 500) {
      return res.status(400).json({ error: 'Details too long (max 500 characters)' });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'report.create',
      data: {
        reporterId: userId,
        reportedEntityId,
        entityType,
        reason,
        details: details || null,
      },
    });

    logger.info(`Report queued: ${entityType} ${reportedEntityId} reported by user ${userId}`);

    res.status(201).json({
      message: 'Report submitted successfully and will be reviewed shortly',
    });
  } catch (error) {
    logger.error('Error queuing report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
