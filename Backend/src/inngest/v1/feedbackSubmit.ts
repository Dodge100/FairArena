import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

interface FeedbackData {
  feedbackCode: string;
  message: string | null;
  rating: number | null;
}

/**
 * Process feedback submission
 */
export const processFeedbackSubmission = inngest.createFunction(
  {
    id: 'feedback-submit',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'feedback/submit' },
  async ({ event }) => {
    const { feedbackCode, message, rating } = event.data as FeedbackData;

    logger.info('Processing feedback submission', { feedbackCode });

    try {
      // Update feedback in database
      await prisma.feedback.update({
        where: { feedbackCode },
        data: {
          message,
          rating,
          isUsed: true,
        },
      });

      logger.info('Feedback updated in database', { feedbackCode });

      const usersWithNotifications = await getReadOnlyPrisma().settings.findMany({
        where: {
          settings: {
            path: ['wantFeedbackNotifications'],
            equals: true,
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
        take: 10, // Limit to prevent overwhelming the system
      });

      // Send notifications to users who want them
      for (const userSetting of usersWithNotifications) {
        try {
          await inngest.send({
            name: 'notification.send',
            data: {
              userId: userSetting.userId,
              type: 'SYSTEM',
              title: 'New Feedback Received',
              message: `A user submitted feedback${rating ? ` with a ${rating}/5 star rating` : ''}${message ? `: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"` : '.'}`,
              description: 'New feedback has been submitted to the platform.',
              actionUrl: null,
              actionLabel: null,
            },
          });
        } catch (notifError) {
          logger.error('Failed to send feedback notification', {
            userId: userSetting.userId,
            error: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }
      }

      logger.info('Feedback processed successfully', {
        feedbackCode,
        notificationsSent: usersWithNotifications.length,
      });
    } catch (error) {
      logger.error('Failed to process feedback', {
        feedbackCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
