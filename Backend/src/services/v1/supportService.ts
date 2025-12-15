import { prisma } from '../../config/database.js';
import { ReportState } from '../../generated/enums.js';
import logger from '../../utils/logger.js';

export interface CreateSupportRequestData {
  userId?: string;
  emailId?: string;
  subject: string;
  message: string;
}

export class SupportService {
  /**
   * Create a new support request
   */
  static async createSupportRequest(data: CreateSupportRequestData) {
    try {
      const supportRequest = await prisma.support.create({
        data: {
          userId: data.userId,
          emailId: data.emailId,
          subject: data.subject,
          message: data.message,
          status: ReportState.QUEUED,
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
