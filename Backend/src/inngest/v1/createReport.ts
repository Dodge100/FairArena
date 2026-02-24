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

import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const createReport = inngest.createFunction(
  {
    id: 'report.create',
    concurrency: {
      limit: 5,
    },
  },
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
      logger.error('Error processing report:', { error });
      return { success: false, error: 'Failed to process report' };
    }
  },
);
