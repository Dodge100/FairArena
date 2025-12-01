import type { Prisma } from '@prisma/client';
import { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis } from '../../config/redis.js';
import logger from '../../utils/logger.js';

// Cache configuration
const CACHE_TTL = {
  UNREAD_COUNT: 60, // 1 minute
  NOTIFICATIONS_LIST: 180, // 3 minutes
} as const;

const CACHE_KEYS = {
  UNREAD_COUNT: (userId: string) => `notification:unread:${userId}`,
  NOTIFICATIONS_LIST: (userId: string, filters: string) => `notification:list:${userId}:${filters}`,
} as const;

export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

class NotificationService {
  /**
   * Get all notifications for a user with filters
   */
  async getUserNotifications(userId: string, filters: NotificationFilters = {}) {
    const filterKey = JSON.stringify(filters);
    const cacheKey = CACHE_KEYS.NOTIFICATIONS_LIST(userId, filterKey);
    const readOnlyPrisma = await getReadOnlyPrisma();

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        // @ts-ignore
        return JSON.parse(cached) as {
          notifications: unknown[];
          total: number;
          hasMore: boolean;
        };
      }
    } catch (error) {
      logger.warn('Redis cache read failed for notifications list', { error, userId });
    }

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (filters.read !== undefined) {
      where.read = filters.read;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const [notifications, total] = await Promise.all([
      readOnlyPrisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      readOnlyPrisma.notification.count({ where }),
    ]);

    const result = {
      notifications,
      total,
      hasMore: (filters.offset || 0) + (filters.limit || 50) < total,
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL.NOTIFICATIONS_LIST, JSON.stringify(result));
    } catch (error) {
      logger.warn('Redis cache write failed for notifications list', { error, userId });
    }

    return result;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = CACHE_KEYS.UNREAD_COUNT(userId);
    const readOnlyPrisma = await getReadOnlyPrisma();

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return Number(cached);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for unread count', { error, userId });
    }

    const count = await readOnlyPrisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    // Cache the count
    try {
      await redis.setex(cacheKey, CACHE_TTL.UNREAD_COUNT, count);
    } catch (error) {
      logger.warn('Redis cache write failed for unread count', { error, userId });
    }

    return count;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[], userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
        userId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Mark a notification as unread
   */
  async markAsUnread(notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: false,
        readAt: null,
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Mark multiple notifications as unread
   */
  async markMultipleAsUnread(notificationIds: string[], userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
        userId,
      },
      data: {
        read: false,
        readAt: null,
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const result = await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(notificationIds: string[], userId: string) {
    const result = await prisma.notification.deleteMany({
      where: {
        id: {
          in: notificationIds,
        },
        userId,
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: string) {
    const result = await prisma.notification.deleteMany({
      where: {
        userId,
        read: true,
      },
    });

    // Invalidate cache
    await this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Delete old read notifications (cleanup job)
   */
  async deleteOldReadNotifications(olderThan: Date) {
    const result = await prisma.notification.deleteMany({
      where: {
        read: true,
        readAt: {
          lt: olderThan,
        },
      },
    });
    return result;
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(notificationId: string, userId: string) {
    const readOnlyPrisma = await getReadOnlyPrisma();
    return await readOnlyPrisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * Invalidate all cache entries for a user
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `notification:*:${userId}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Failed to invalidate notification cache', { error, userId });
    }
  }
}

export default new NotificationService();
