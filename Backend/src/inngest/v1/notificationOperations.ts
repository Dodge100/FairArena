import notificationService from '../../services/v1/notification.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Send a notification to a user
 */
export const sendNotification = inngest.createFunction(
  {
    id: 'notification/send',
    name: 'Send Notification',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/send' },
  async ({ event, step }) => {
    const { userId, title, message, description, actionUrl, actionLabel, metadata } = event.data;

    // Validate required fields and provide defaults
    if (!userId) {
      throw new Error('userId is required for notification/send event');
    }
    const notificationTitle = title || 'Notification';
    const notificationMessage = message || 'You have a new notification';
    const notificationDescription = description || '';

    return await step.run('send-notification', async () => {
      try {
        // All notifications are system notifications
        const notification = await notificationService.createNotification({
          userId,
          type: 'SYSTEM',
          title: notificationTitle,
          message: notificationMessage,
          description: notificationDescription,
          actionUrl,
          actionLabel,
          metadata,
        });

        logger.info('Notification created', {
          userId,
          notificationId: notification.id,
          type: 'SYSTEM',
          title,
        });

        // Send push notification asynchronously
        await inngest.send({
          name: 'notification/send-push',
          data: {
            userId,
            title,
            body: description || message,
            data: {
              notificationId: notification.id,
              type: 'SYSTEM',
              ...(actionUrl && { actionUrl }),
            },
            notificationId: notification.id,
          },
        });

        return {
          success: true,
          notificationId: notification.id,
        };
      } catch (error) {
        logger.error('Failed to send notification', {
          error,
          userId,
          title,
        });
        throw error;
      }
    });
  },
);

/**
 * Mark multiple notifications as read asynchronously
 * Use this for bulk operations to avoid blocking the HTTP request
 */
export const markNotificationsAsRead = inngest.createFunction(
  {
    id: 'mark-notifications-as-read',
    name: 'Mark Notifications as Read',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/mark-as-read' },
  async ({ event, step }) => {
    const { notificationIds, userId } = event.data;

    return await step.run('mark-as-read', async () => {
      try {
        await notificationService.markMultipleAsRead(notificationIds, userId);

        logger.info('Notifications marked as read', {
          userId,
          count: notificationIds.length,
        });

        return {
          success: true,
          count: notificationIds.length,
        };
      } catch (error) {
        logger.error('Failed to mark notifications as read', {
          error,
          userId,
          notificationIds,
        });
        throw error;
      }
    });
  },
);

/**
 * Mark multiple notifications as unread asynchronously
 */
export const markNotificationsAsUnread = inngest.createFunction(
  {
    id: 'mark-notifications-as-unread',
    name: 'Mark Notifications as Unread',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/mark-as-unread' },
  async ({ event, step }) => {
    const { notificationIds, userId } = event.data;

    return await step.run('mark-as-unread', async () => {
      try {
        await notificationService.markMultipleAsUnread(notificationIds, userId);

        logger.info('Notifications marked as unread', {
          userId,
          count: notificationIds.length,
        });

        return {
          success: true,
          count: notificationIds.length,
        };
      } catch (error) {
        logger.error('Failed to mark notifications as unread', {
          error,
          userId,
          notificationIds,
        });
        throw error;
      }
    });
  },
);

/**
 * Mark all notifications as read for a user asynchronously
 */
export const markAllNotificationsAsRead = inngest.createFunction(
  {
    id: 'mark-all-notifications-as-read',
    name: 'Mark All Notifications as Read',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/mark-all-as-read' },
  async ({ event, step }) => {
    const { userId } = event.data;

    return await step.run('mark-all-as-read', async () => {
      try {
        const result = await notificationService.markAllAsRead(userId);

        logger.info('All notifications marked as read', {
          userId,
          count: result.count,
        });

        return {
          success: true,
          count: result.count,
        };
      } catch (error) {
        logger.error('Failed to mark all notifications as read', {
          error,
          userId,
        });
        throw error;
      }
    });
  },
);

/**
 * Delete multiple notifications asynchronously
 */
export const deleteNotifications = inngest.createFunction(
  {
    id: 'delete-notifications',
    name: 'Delete Notifications',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/delete' },
  async ({ event, step }) => {
    const { notificationIds, userId } = event.data;

    return await step.run('delete-notifications', async () => {
      try {
        await notificationService.deleteMultipleNotifications(notificationIds, userId);

        logger.info('Notifications deleted', {
          userId,
          count: notificationIds.length,
        });

        return {
          success: true,
          count: notificationIds.length,
        };
      } catch (error) {
        logger.error('Failed to delete notifications', {
          error,
          userId,
          notificationIds,
        });
        throw error;
      }
    });
  },
);

/**
 * Delete all read notifications for a user asynchronously
 */
export const deleteAllReadNotifications = inngest.createFunction(
  {
    id: 'delete-all-read-notifications',
    name: 'Delete All Read Notifications',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/delete-all-read' },
  async ({ event, step }) => {
    const { userId } = event.data;

    return await step.run('delete-all-read', async () => {
      try {
        const result = await notificationService.deleteAllRead(userId);

        logger.info('All read notifications deleted', {
          userId,
          count: result.count,
        });

        return {
          success: true,
          count: result.count,
        };
      } catch (error) {
        logger.error('Failed to delete all read notifications', {
          error,
          userId,
        });
        throw error;
      }
    });
  },
);

/**
 * Send push notification asynchronously - checks user presence and preferences
 */
export const sendPushNotification = inngest.createFunction(
  {
    id: 'notification/send-push',
    name: 'Send Push Notification',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'notification/send-push' },
  async ({ event, step }) => {
    const { userId, title, body, data, notificationId } = event.data;

    try {
      // Check if push notifications are enabled in settings
      const pushEnabled = await step.run('check-push-preferences', async () => {
        const { prisma } = await import('../../config/database.js');
        const settings = await prisma.settings.findUnique({
          where: { userId },
          select: { settings: true },
        });
        return (settings?.settings as any)?.pushNotificationsEnabled ?? true;
      });

      if (!pushEnabled) {
        logger.info('Push notifications disabled in settings', { userId, notificationId });
        return { success: true, skipped: true, reason: 'push_disabled' };
      }

      // Get all FCM tokens for the user (multiple devices)
      const fcmTokens = await step.run('get-fcm-tokens', async () => {
        const { prisma } = await import('../../config/database.js');
        const tokens = await prisma.fCMToken.findMany({
          where: { userId },
          select: { token: true },
        });
        return tokens.map((t) => t.token);
      });

      if (!fcmTokens || fcmTokens.length === 0) {
        logger.info('No FCM tokens found', { userId, notificationId });
        return { success: true, skipped: true, reason: 'no_fcm_token' };
      }

      // Send push notification to all devices
      const result = await step.run('send-fcm-push', async () => {
        const { sendSmartNotification } = await import('../../services/v1/fcmService.js');
        return await sendSmartNotification(userId, {
          title,
          body,
          data: data || {},
        });
      });

      if (result.successCount > 0) {
        logger.info('Push notifications sent successfully', {
          userId,
          notificationId,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
        return {
          success: true,
          sent: true,
          successCount: result.successCount,
          failureCount: result.failureCount,
        };
      } else {
        logger.warn('Failed to send push notifications to any device', {
          userId,
          notificationId,
          failureCount: result.failureCount,
        });
        return {
          success: false,
          error: 'Failed to send to any device',
          failureCount: result.failureCount,
        };
      }
    } catch (error) {
      logger.error('Error in sendPushNotification', { error, userId, notificationId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
);
