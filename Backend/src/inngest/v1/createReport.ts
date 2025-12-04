import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

export const createReport = inngest.createFunction(
  { id: 'report.create' },
  { event: 'report.create' },
  async ({ event }) => {
    const { reporterId, reportedEntityId, entityType, reason, details } = event.data;
    const readOnlyPrisma = getReadOnlyPrisma();

    try {
      logger.info(`Processing report: ${entityType} ${reportedEntityId} by ${reporterId}`);

      // Verify reporter exists
      const reporter = await readOnlyPrisma.user.findUnique({
        where: { id: reporterId },
        select: { id: true, email: true },
      });

      if (!reporter) {
        logger.warn(`Report failed: reporter ${reporterId} not found`);
        return { success: false, error: 'Reporter not found' };
      }

      // Create the report
      const report = await prisma.report.create({
        data: {
          reporterId,
          reportedEntityId,
          entityType,
          reason,
          details,
        },
      });

      // Log the report creation
      await prisma.logs.create({
        data: {
          userId: reporterId,
          action: 'report_created',
          level: 'INFO',
          metadata: {
            reportId: report.id,
            reportedEntityId,
            entityType,
            reason,
            details: details || null,
          },
        },
      });

      logger.info(`Report created successfully: ${report.id}`);

      return {
        success: true,
        reportId: report.id,
        message: 'Report processed successfully',
      };
    } catch (error) {
      logger.error('Error processing report:', {error});
      return { success: false, error: 'Failed to process report' };
    }
  },
);
