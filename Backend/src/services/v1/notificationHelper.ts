import { redis } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

/**
 * Check if user is currently on the inbox page
 */
export const isUserOnInboxPage = async (userId: string): Promise<boolean> => {
  try {
    const cacheKey = `inbox:active:${userId}`;
    const isActive = await redis.get(cacheKey);
    return isActive === '1';
  } catch (error) {
    logger.error('Error checking inbox page status', { error, userId });
    return false;
  }
};

/**
 * Send notification to user asynchronously - triggers Inngest event for push notifications
 * This replaces the synchronous notifyUser function for production readiness
 */
export const notifyUserAsync = async (
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    notificationId?: string;
  },
): Promise<void> => {
  try {
    // Trigger asynchronous push notification via Inngest
    await inngest.send({
      name: 'notification/send-push',
      data: {
        userId,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        notificationId: notification.notificationId,
      },
    });

    logger.info('Push notification event triggered asynchronously', {
      userId,
      notificationId: notification.notificationId,
    });
  } catch (error) {
    logger.error('Error triggering async push notification', { error, userId });
    // Don't throw - async notifications shouldn't break the main flow
  }
};

/**
 * Legacy synchronous function - kept for backward compatibility
 * @deprecated Use notifyUserAsync instead for production
 */
export const notifyUser = async (
  userId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<{ inAppOnly: boolean; pushSent: boolean }> => {
  logger.warn('notifyUser (synchronous) is deprecated, use notifyUserAsync instead', { userId });

  // For backward compatibility, trigger async notification
  await notifyUserAsync(userId, notification);

  // Return legacy response format
  return { inAppOnly: false, pushSent: true };
};
