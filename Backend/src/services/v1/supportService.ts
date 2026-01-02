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
