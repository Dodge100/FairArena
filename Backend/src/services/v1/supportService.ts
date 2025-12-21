import { prisma } from '../../config/database.js';
import { ReportSeverity, ReportState, ReportType } from '../../generated/enums.js';
import logger from '../../utils/logger.js';
import { getAIClassificationService } from './aiClassificationService.js';

export interface CreateSupportRequestData {
  userId?: string;
  emailId?: string;
  subject: string;
  message: string;
  shortDescription?: string;
  type?: ReportType;
  severity?: ReportSeverity;
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
          shortDescription: data.shortDescription,
          type: data.type || ReportType.OTHER,
          severity: data.severity || ReportSeverity.LOW,
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

  /**
   * Classify a support ticket using AI and update it
   */
  static async classifyAndUpdateTicket(ticketId: string) {
    try {
      // Fetch the ticket
      const ticket = await prisma.support.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          subject: true,
          message: true,
          shortDescription: true,
        },
      });

      if (!ticket) {
        throw new Error(`Support ticket not found: ${ticketId}`);
      }

      // Skip if already has a short description
      if (ticket.shortDescription) {
        logger.info('Ticket already has a short description, skipping AI classification', {
          ticketId,
        });
        return ticket;
      }

      logger.info('Classifying support ticket with AI', { ticketId });

      // Get AI classification
      const aiService = getAIClassificationService();
      const classification = await aiService.classifySupportTicket(
        ticket.subject,
        ticket.message,
      );

      // Update the ticket with classification
      const updatedTicket = await prisma.support.update({
        where: { id: ticketId },
        data: {
          shortDescription: classification.shortDescription,
          type: classification.type,
          severity: classification.severity,
        },
      });

      logger.info('Support ticket classified and updated successfully', {
        ticketId,
        type: classification.type,
        severity: classification.severity,
      });

      return updatedTicket;
    } catch (error) {
      logger.error('Error classifying and updating support ticket:', {
        ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Batch classify existing tickets that don't have classifications
   */
  static async classifyUnclassifiedTickets(limit: number = 50) {
    try {
      // Find tickets without short descriptions
      const unclassifiedTickets = await prisma.support.findMany({
        where: {
          shortDescription: null,
        },
        select: {
          id: true,
          subject: true,
          message: true,
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (unclassifiedTickets.length === 0) {
        logger.info('No unclassified tickets found');
        return { processed: 0, successful: 0, failed: 0 };
      }

      logger.info('Starting batch classification of tickets', {
        count: unclassifiedTickets.length,
      });

      const aiService = getAIClassificationService();
      const classifications = await aiService.classifyBatch(unclassifiedTickets);

      let successful = 0;
      let failed = 0;

      // Update tickets with classifications
      for (const [ticketId, classification] of classifications.entries()) {
        try {
          await prisma.support.update({
            where: { id: ticketId },
            data: {
              shortDescription: classification.shortDescription,
              type: classification.type,
              severity: classification.severity,
            },
          });
          successful++;
        } catch (error) {
          logger.error('Error updating ticket with classification', {
            ticketId,
            error: error instanceof Error ? error.message : String(error),
          });
          failed++;
        }
      }

      logger.info('Batch classification completed', {
        total: unclassifiedTickets.length,
        successful,
        failed,
      });

      return {
        processed: unclassifiedTickets.length,
        successful,
        failed,
      };
    } catch (error) {
      logger.error('Error in batch classification:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
