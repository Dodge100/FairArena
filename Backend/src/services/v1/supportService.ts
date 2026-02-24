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
import { ReportSeverity, ReportState, ReportType } from '../../generated/enums.js';
import logger from '../../utils/logger.js';

export interface CreateSupportRequestData {
  emailId: string;
  userId?: string;
  subject: string;
  message: string;
  type?: ReportType;
  severity?: ReportSeverity;
  shortDescription?: string;
}

export class SupportService {
  /**
   * Create a new support request
   */
  static async createSupportRequest(data: CreateSupportRequestData) {
    try {
      const supportRequest = await prisma.support.create({
        data: {
          userId: data.userId || null,
          emailId: data.emailId,
          subject: data.subject,
          message: data.message,
          status: ReportState.QUEUED,
          type: data.type || ReportType.BUG,
          severity: data.severity || ReportSeverity.LOW,
          shortDescription: data.shortDescription,
        },
        include: {
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      return supportRequest;
    } catch (error) {
      logger.error('Error creating support request:', { error });
      throw new Error('Failed to create support request');
    }
  }
}
