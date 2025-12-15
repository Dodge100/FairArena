import { Request, Response } from 'express';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { Verifier } from '../../utils/settings-token-verfier.js';

// Cache configuration
const CACHE_TTL = {
  USER_REPORTS: 3600,
} as const;

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

    Verifier(req, res, auth);

    const cacheKey = `${REDIS_KEYS.USER_REPORTS_CACHE}${userId}`;

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      logger.info(`Reports cache check for user ${userId}: ${cached ? 'HIT' : 'MISS'}`, {
        cacheKey,
        cachedType: typeof cached,
      });
      if (cached !== null && cached !== undefined) {
        try {
          logger.info('Returning cached reports data', { userId });
          const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.status(200).json(parsedData);
        } catch (parseError) {
          logger.warn('Failed to parse cached reports data, falling back to database', {
            error: parseError,
            userId,
          });
          // Continue to database query
        }
      }
    } catch (error) {
      logger.warn('Redis cache read failed for user reports', { error, userId });
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

    const responseData = {
      success: true,
      reports: reports.map((report) => ({
        id: report.id,
        title: `${report.entityType} report - ${report.reason}`,
        description: report.details || `Reported ${report.entityType} for ${report.reason}`,
        status: report.state.toLowerCase(),
        createdAt: report.createdAt.toISOString(),
      })),
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL.USER_REPORTS, JSON.stringify(responseData));
      logger.info('Reports cache set successfully', { userId, cacheKey });
    } catch (error) {
      logger.warn('Redis cache write failed for user reports', { error, userId });
    }

    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error fetching user reports:', { error });
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
        state: { in: ['QUEUED', 'IN_REVIEW', 'ESCALATED'] },
      },
    });

    if (existingReport) {
      return res
        .status(409)
        .json({ error: 'You have already reported this entity and it is under review' });
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

    // Invalidate user reports cache
    const cacheKey = `${REDIS_KEYS.USER_REPORTS_CACHE}${userId}`;
    try {
      await redis.del(cacheKey);
      logger.info('User reports cache invalidated', { userId });
    } catch (error) {
      logger.warn('Failed to invalidate user reports cache', { error, userId });
    }

    logger.info(`Report queued: ${entityType} ${reportedEntityId} reported by user ${userId}`);

    res.status(201).json({
      message: 'Report submitted successfully and will be reviewed shortly',
    });
  } catch (error) {
    logger.error('Error queuing report:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
