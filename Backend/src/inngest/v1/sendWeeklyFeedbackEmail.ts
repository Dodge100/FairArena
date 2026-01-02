import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { sendEmail } from '../../email/v1/send-mail.js';
import { NotificationType } from '../../generated/enums.js';
import notificationService from '../../services/v1/notification.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { DEFAULT_USER_SETTINGS } from './settingsOperations.js';

// Default settings for users who haven't set preferences
const DEFAULT_SETTINGS = DEFAULT_USER_SETTINGS;

interface UserSettings {
  wantToGetFeedbackMail?: boolean;
  wantFeedbackNotifications?: boolean;
}

export const sendWeeklyFeedbackEmail = inngest.createFunction(
  {
    id: 'send-weekly-feedback-email',
    concurrency: {
      limit: 5,
    },
  },
  { cron: '0 0 * * 0' }, // Every Sunday at midnight
  async () => {
    logger.info('Starting weekly feedback email job');

    try {
      // Get all users with their settings (if any)
      const allUsers = await getReadOnlyPrisma().user.findMany({
        select: {
          userId: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          settings: {
            select: {
              settings: true,
            },
          },
        },
      });

      // Filter users who want feedback emails (using defaults for missing settings)
      const usersWithFeedbackEnabled = allUsers.filter((user) => {
        const userSettings = user.settings?.settings as UserSettings;
        const wantFeedbackMail =
          userSettings?.wantToGetFeedbackMail ?? DEFAULT_SETTINGS.wantToGetFeedbackMail;
        return wantFeedbackMail === true;
      });

      // Filter users who want feedback notifications (using defaults for missing settings)
      const usersWithNotificationsEnabled = allUsers.filter((user) => {
        const userSettings = user.settings?.settings as UserSettings;
        const wantFeedbackNotifications =
          userSettings?.wantFeedbackNotifications ?? DEFAULT_SETTINGS.wantFeedbackNotifications;
        return wantFeedbackNotifications === true;
      });

      logger.info(
        `Found ${usersWithFeedbackEnabled.length} users with feedback emails enabled (out of ${allUsers.length} total users)`,
      );
      logger.info(
        `Found ${usersWithNotificationsEnabled.length} users with feedback notifications enabled (out of ${allUsers.length} total users)`,
      );

      // Process in batches of 100 to avoid overwhelming the system
      const batchSize = 100;
      for (let i = 0; i < usersWithFeedbackEnabled.length; i += batchSize) {
        const batch = usersWithFeedbackEnabled.slice(i, i + batchSize);
        logger.info(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(usersWithFeedbackEnabled.length / batchSize)}`,
        );

        await Promise.all(
          batch.map(async (user) => {
            try {
              // Generate unique feedback code
              const feedbackCode = createId();

              // Create feedback entry
              await prisma.feedback.create({
                data: {
                  feedbackCode,
                  isUsed: false,
                },
              });

              // Send email
              const name = user.profile?.firstName
                ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
                : 'there';

              const unsubscribeUrl = `${process.env.FRONTEND_URL}/dashboard/account-settings`;

              await sendEmail({
                to: user.email,
                subject: "We'd love your feedback!",
                templateType: 'weekly-feedback',
                templateData: {
                  name,
                  feedbackUrl: `${process.env.FRONTEND_URL}/feedback/${feedbackCode}`,
                },
                headers: {
                  'List-Unsubscribe': `<${unsubscribeUrl}>`,
                },
              });

              logger.info(`Sent feedback email to user ${user.userId}`);
            } catch (error) {
              logger.error(`Failed to send feedback email to user ${user.userId}`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }),
        );

        // Small delay between batches to prevent overwhelming email service
        if (i + batchSize < usersWithFeedbackEnabled.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Send in-app notifications to users who opted in
      logger.info('Starting to send in-app notifications');

      // Process notification users in batches
      for (let i = 0; i < usersWithNotificationsEnabled.length; i += batchSize) {
        const batch = usersWithNotificationsEnabled.slice(i, i + batchSize);
        logger.info(
          `Processing notification batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(usersWithNotificationsEnabled.length / batchSize)}`,
        );

        await Promise.all(
          batch.map(async (user) => {
            try {
              const name = user.profile?.firstName
                ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
                : 'there';

              // Create feedback entry for notification users too
              const feedbackCode = createId();
              await prisma.feedback.create({
                data: {
                  feedbackCode,
                  isUsed: false,
                },
              });

              const notificationUrl = `${process.env.FRONTEND_URL}/feedback/${feedbackCode}`;

              await notificationService.createNotification({
                userId: user.userId,
                type: NotificationType.REMINDER,
                title: "We'd love your feedback!",
                message: `<p>Hi ${name},</p><p>Thank you for being part of FairArena! Your feedback helps us improve and build features that matter to you.</p><p>We'd love to hear your thoughts, suggestions, or any issues you've encountered. It only takes a minute!</p>`,
                description: 'Weekly feedback request from FairArena team',
                actionUrl: notificationUrl,
                actionLabel: 'Share Your Feedback',
                metadata: {
                  feedbackCode,
                  type: 'weekly-feedback',
                },
              });

              logger.info(`Sent feedback notification to user ${user.userId}`);
            } catch (error) {
              logger.error(`Failed to send feedback notification to user ${user.userId}`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }),
        );

        // Small delay between batches
        if (i + batchSize < usersWithNotificationsEnabled.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      logger.info('Completed weekly feedback email and notification job');
    } catch (error) {
      logger.error('Weekly feedback email job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
