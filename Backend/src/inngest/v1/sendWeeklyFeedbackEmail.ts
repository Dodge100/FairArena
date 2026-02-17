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
      limit: 1, // Limit to 1 to prevent any potential overlap, though cron should trigger once
    },
  },
  { cron: '0 0 * * 0' }, // Every Sunday at midnight
  async ({ step }) => {
    logger.info('Starting weekly feedback email job');

    try {
      // Step 1: Fetch and categorize users
      const { emailUsers, notificationUsers } = await step.run('fetch-target-users', async () => {
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

        // Filter users who want feedback emails
        const emailUsers = allUsers.filter((user) => {
          const userSettings = user.settings?.settings as UserSettings;
          const wantFeedbackMail =
            userSettings?.wantToGetFeedbackMail ?? DEFAULT_SETTINGS.wantToGetFeedbackMail;
          return wantFeedbackMail === true;
        });

        // Filter users who want feedback notifications
        const notificationUsers = allUsers.filter((user) => {
          const userSettings = user.settings?.settings as UserSettings;
          const wantFeedbackNotifications =
            userSettings?.wantFeedbackNotifications ?? DEFAULT_SETTINGS.wantFeedbackNotifications;
          return wantFeedbackNotifications === true;
        });

        logger.info(
          `Found ${emailUsers.length} users for emails and ${notificationUsers.length} users for notifications`,
        );

        return { emailUsers, notificationUsers };
      });

      // Step 2: Send emails
      await step.run('send-feedback-emails', async () => {
        if (emailUsers.length === 0) return { sent: 0 };

        const batchSize = 50; // Smaller batch size for better reliability
        let sentCount = 0;

        for (let i = 0; i < emailUsers.length; i += batchSize) {
          const batch = emailUsers.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async (user) => {
              try {
                const feedbackCode = createId();

                await prisma.feedback.create({
                  data: {
                    feedbackCode,
                    isUsed: false,
                  },
                });

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
                sentCount++;
              } catch (error) {
                logger.error(`Failed to send feedback email to user ${user.userId}`, {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }),
          );

          // Small delay between batches
          if (i + batchSize < emailUsers.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        return { sent: sentCount };
      });

      // Step 3: Send notifications
      await step.run('send-feedback-notifications', async () => {
        if (notificationUsers.length === 0) return { sent: 0 };

        const batchSize = 50;
        let sentCount = 0;

        for (let i = 0; i < notificationUsers.length; i += batchSize) {
          const batch = notificationUsers.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async (user) => {
              try {
                const name = user.profile?.firstName
                  ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
                  : 'there';

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
                sentCount++;
              } catch (error) {
                logger.error(`Failed to send feedback notification to user ${user.userId}`, {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }),
          );
        }
        return { sent: sentCount };
      });

      logger.info('Completed weekly feedback email and notification job');
      return { success: true };
    } catch (error) {
      logger.error('Weekly feedback email job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
