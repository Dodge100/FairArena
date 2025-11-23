import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

interface CreateReportRequest {
  reportedEntityId: string;
  entityType: string;
  reason: string;
  details?: string;
}

export const GetUserReports = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const readOnlyPrisma = getReadOnlyPrisma();

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      purpose: string;
    };

    // Verify the token is for account settings
    if (decoded.purpose !== 'account-settings') {
      logger.warn('Invalid token purpose', { purpose: decoded.purpose });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const reports = await readOnlyPrisma.report.findMany({
      where: {
        reporterId: userId,
      },
      select: {
        id: true,
        reportedEntityId: true,
        entityType: true,
        reason: true,
        details: true,
        state: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      reports: reports.map((report) => ({
        id: report.id,
        title: `${report.entityType} report - ${report.reason}`,
        description: report.details || `Reported ${report.entityType} for ${report.reason}`,
        status: report.state.toLowerCase(),
        createdAt: report.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Error fetching user reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const CreateReport = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth.userId;
    const readOnlyPrisma = getReadOnlyPrisma();

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

    const existingReport = await readOnlyPrisma.report.findFirst({
      where: {
      reporterId: userId,
      reportedEntityId,
      state: { in: ['QUEUED', 'IN_REVIEW'] },
      },
    });

    if (existingReport) {
      return res.status(409).json({ error: 'You have already reported this entity and it is under review' });
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
