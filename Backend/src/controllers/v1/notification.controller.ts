import type { Request, Response } from 'express';
import { z } from 'zod';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import notificationService from '../../services/v1/notification.service.js';
import logger from '../../utils/logger.js';

// Validation schemas
const markAsReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

const getNotificationsQuerySchema = z.object({
  read: z.enum(['true', 'false']).optional(),
  type: z
    .enum([
      'SYSTEM',
      'MENTION',
      'INVITATION',
      'ACHIEVEMENT',
      'UPDATE',
      'REMINDER',
      'ALERT',
      'MESSAGE',
      'FOLLOW',
      'STAR',
      'COMMENT',
      'ANNOUNCEMENT',
    ])
    .optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

/**
 * Get all notifications for authenticated user
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate query parameters
    const queryResult = getNotificationsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryResult.error.issues,
      });
    }

    const { read, type, limit, offset } = queryResult.data;

    const filters = {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      type: type as
        | 'SYSTEM'
        | 'MENTION'
        | 'INVITATION'
        | 'ACHIEVEMENT'
        | 'UPDATE'
        | 'REMINDER'
        | 'ALERT'
        | 'MESSAGE'
        | 'FOLLOW'
        | 'STAR'
        | 'COMMENT'
        | 'ANNOUNCEMENT'
        | undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };

    const result = await notificationService.getUserNotifications(userId, filters);

    // Add cache headers for CDN/browser caching
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching notifications', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cacheKey = `${REDIS_KEYS.USER_UNREAD_NOTIFICATIONS}${userId}`;

    // Try to get from cache
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData !== null) {
        const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        logger.info('Serving unread count from cache', { userId });
        return res.json({
          success: true,
          data,
        });
      }
    } catch (cacheError) {
      logger.warn('Redis cache read failed, proceeding with database query', {
        error: (cacheError as Error).message,
        userId,
      });
    }

    const count = await notificationService.getUnreadCount(userId);

    const responseData = { count };

    // Cache the response
    try {
      await redis.setex(cacheKey, 60, JSON.stringify(responseData)); // 1 minute TTL
      logger.info('Cached unread count', { userId, cacheKey });
    } catch (cacheError) {
      logger.warn('Redis cache write failed', {
        error: (cacheError as Error).message,
        userId,
      });
    }

    // Add cache headers for frequent polling
    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Error fetching unread count', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

/**
 * Mark notification as read (async with Inngest)
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'notification/mark-as-read',
      data: {
        notificationIds: [id],
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Notification is being marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * Mark notification as unread (async with Inngest)
 */
export const markAsUnread = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'notification/mark-as-unread',
      data: {
        notificationIds: [id],
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Notification is being marked as unread',
    });
  } catch (error) {
    logger.error('Error marking notification as unread', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to mark notification as unread' });
  }
};

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = markAsReadSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: result.error.issues,
      });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'notification/mark-as-read',
      data: {
        notificationIds: result.data.notificationIds,
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Notifications are being marked as read',
    });
  } catch (error) {
    logger.error('Error marking notifications as read', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'notification/mark-all-as-read',
      data: { userId },
    });

    res.json({
      success: true,
      message: 'All notifications are being marked as read',
    });
  } catch (error) {
    logger.error('Error marking all notifications as read', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

/**
 * Delete a notification (async with Inngest)
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Send to Inngest for async deletion
    await inngest.send({
      name: 'notification/delete',
      data: {
        notificationIds: [id],
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Notification is being deleted',
    });
  } catch (error) {
    logger.error('Error deleting notification', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

/**
 * Delete all read notifications
 */
export const deleteAllRead = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'notification/delete-all-read',
      data: { userId },
    });

    res.json({
      success: true,
      message: 'All read notifications are being deleted',
    });
  } catch (error) {
    logger.error('Error deleting read notifications', { error, userId: req.auth()?.userId });
    res.status(500).json({ error: 'Failed to delete read notifications' });
  }
};
