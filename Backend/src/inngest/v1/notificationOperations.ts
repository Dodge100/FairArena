import notificationService from '../../services/v1/notification.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Mark multiple notifications as read asynchronously
 * Use this for bulk operations to avoid blocking the HTTP request
 */
export const markNotificationsAsRead = inngest.createFunction(
  {
    id: 'mark-notifications-as-read',
    name: 'Mark Notifications as Read',
    concurrency: {
      limit: 50,
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
      limit: 50,
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
      limit: 50,
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
      limit: 50,
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
      limit: 50,
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
