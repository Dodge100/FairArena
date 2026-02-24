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

import { redis, REDIS_KEYS } from '../../config/redis.js';
import notificationService from '../../services/v1/notification.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Invalidate all notification caches for a user
 */
async function invalidateNotificationCaches(userId: string) {
  try {
    // Invalidate unread count cache
    await redis.del(`${REDIS_KEYS.USER_UNREAD_NOTIFICATIONS}${userId}`);

    // Invalidate notifications list caches (pattern: notification:list:${userId}:*)
    const listKeys = await redis.keys(`notification:list:${userId}:*`);
    if (listKeys.length > 0) {
      await redis.del(...listKeys);
    }

    logger.info('Notification caches invalidated', { userId, listKeysCount: listKeys.length });
  } catch (cacheError) {
    logger.warn('Failed to invalidate notification caches', { cacheError, userId });
  }
}

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

        // Invalidate notification caches
        await invalidateNotificationCaches(userId);

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

        // Invalidate notification caches
        await invalidateNotificationCaches(userId);

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

        // Invalidate notification caches
        await invalidateNotificationCaches(userId);

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

        // Invalidate notification caches
        await invalidateNotificationCaches(userId);

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

        // Invalidate notification caches
        await invalidateNotificationCaches(userId);

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

        // Invalidate notification caches (list cache changes, but unread count may not)
        await invalidateNotificationCaches(userId);

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
