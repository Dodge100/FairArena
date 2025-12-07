import admin from 'firebase-admin';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { getUserPresence } from './presenceService.js';
import { checkNotificationRateLimit } from './rateLimitService.js';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

try {
  if (ENV.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } else {
    logger.warn('Firebase service account not configured');
  }
} catch (error) {
  logger.error('Failed to initialize Firebase Admin SDK', { error });
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  badge?: number;
  sound?: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  ttl?: number;
  collapseKey?: string;
}

interface PushNotificationResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

interface BatchPushResult {
  successCount: number;
  failureCount: number;
  failedTokens?: string[];
  results?: Array<{
    token: string;
    success: boolean;
    error?: string;
    messageId?: string;
  }>;
}

/**
 * Clean up invalid or expired FCM token from database
 */
export const cleanupInvalidToken = async (fcmToken: string, reason?: string): Promise<void> => {
  try {
    const deleted = await prisma.fCMToken.deleteMany({
      where: { token: fcmToken },
    });

    if (deleted.count > 0) {
      logger.info('Cleaned up invalid FCM token', {
        token: fcmToken.substring(0, 20) + '...',
        reason,
        count: deleted.count,
      });

      // Track in analytics
      await trackTokenCleanup(fcmToken, reason || 'invalid_token');
    }
  } catch (error) {
    logger.error('Error cleaning up invalid FCM token', {
      error,
      token: fcmToken.substring(0, 20),
    });
  }
};

/**
 * Update FCM token last used timestamp and failure count
 */
async function updateTokenUsage(
  token: string,
  success: boolean,
  failureReason?: string,
): Promise<void> {
  try {
    if (success) {
      await prisma.fCMToken.updateMany({
        where: { token },
        data: {
          lastUsedAt: new Date(),
          failureCount: 0,
          lastFailureAt: null,
          lastFailureReason: null,
        },
      });
    } else {
      const tokenRecord = await prisma.fCMToken.findFirst({
        where: { token },
        select: { failureCount: true, id: true },
      });

      if (tokenRecord) {
        const newFailureCount = (tokenRecord.failureCount || 0) + 1;

        // If too many failures, mark as inactive or delete
        if (newFailureCount >= 5) {
          await cleanupInvalidToken(token, failureReason || 'too_many_failures');
        } else {
          await prisma.fCMToken.update({
            where: { id: tokenRecord.id },
            data: {
              failureCount: newFailureCount,
              lastFailureAt: new Date(),
              lastFailureReason: failureReason,
              lastUsedAt: new Date(),
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error updating token usage', { error, token: token.substring(0, 20) });
  }
}

/**
 * Track token cleanup in analytics
 */
async function trackTokenCleanup(token: string, reason: string): Promise<void> {
  try {
    const key = `${REDIS_KEYS.ANALYTICS}:fcm:cleanup:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(key, reason, 1);
    await redis.expire(key, 86400 * 30); // Keep for 30 days
  } catch (error) {
    logger.error('Error tracking token cleanup', { error });
  }
}

/**
 * Get smart notification routing - select best devices to send to
 */
async function getSmartDeviceRouting(
  userId: string,
  sendToAll: boolean = false,
): Promise<Array<{ tokenId: string; token: string; deviceId: string; priority: number }>> {
  try {
    // Get user presence to check which devices are active
    const presence = await getUserPresence(userId);
    const activeDeviceIds = presence.isOnline ? presence.activeDeviceIds : [];

    // Get all user's FCM tokens
    const tokens = await prisma.fCMToken.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        token: true,
        deviceId: true,
        deviceType: true,
        lastUsedAt: true,
        failureCount: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }],
    });

    if (tokens.length === 0) {
      return [];
    }

    // Calculate priority for each device
    const devicesWithPriority = tokens.map((t) => {
      let priority = 0;

      // Active devices get highest priority
      if (activeDeviceIds.includes(t.deviceId)) {
        priority += 100;
      }

      // Recently used devices
      const hoursSinceLastUse = (Date.now() - t.lastUsedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUse < 1) priority += 50;
      else if (hoursSinceLastUse < 24) priority += 20;
      else if (hoursSinceLastUse < 168) priority += 5;

      // Mobile devices get priority
      if (t.deviceType === 'mobile' || t.deviceType === 'tablet') {
        priority += 10;
      }

      // Penalize devices with failures
      priority -= (t.failureCount || 0) * 5;

      return {
        tokenId: t.id,
        token: t.token,
        deviceId: t.deviceId,
        priority,
      };
    });

    // Sort by priority
    devicesWithPriority.sort((a, b) => b.priority - a.priority);

    // If user is online, only send to active devices unless sendToAll is true
    if (presence.isOnline && !sendToAll && activeDeviceIds.length > 0) {
      return devicesWithPriority.filter((d) => activeDeviceIds.includes(d.deviceId));
    }

    // If sendToAll is false, only send to top 3 devices
    if (!sendToAll) {
      return devicesWithPriority.slice(0, 3);
    }

    return devicesWithPriority;
  } catch (error) {
    logger.error('Error getting smart device routing', { error, userId });
    return [];
  }
}

/**
 * Send push notification to a specific FCM token
 */
export const sendPushNotification = async (
  fcmToken: string,
  payload: PushNotificationPayload,
): Promise<PushNotificationResult> => {
  if (!firebaseInitialized) {
    logger.warn('Firebase not initialized, cannot send push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.icon || `${ENV.BASE_URL}/fairArenaLogotop.png`,
      },
      data: payload.data || {},
      webpush: {
        fcmOptions: {
          link: `${ENV.FRONTEND_URL}/dashboard/inbox`,
        },
        notification: {
          icon: payload.icon || `${ENV.BASE_URL}/fairArenaLogotop.png`,
          badge: `${ENV.BASE_URL}/fairArenaLogotop.png`,
          requireInteraction: false,
        },
      },
    };

    const response = await admin.messaging().send(message);
    logger.info('Push notification sent successfully', { messageId: response });

    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    logger.error('Error sending push notification', { error, fcmToken });

    // Handle invalid token errors and clean them up
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered'
    ) {
      // Clean up the invalid token from database
      await cleanupInvalidToken(fcmToken);
      return { success: false, error: 'Invalid or expired FCM token' };
    }

    return { success: false, error: err.message || 'Failed to send notification' };
  }
};

/**
 * Send push notification to multiple FCM tokens
 */
export const sendMulticastPushNotification = async (
  fcmTokens: string[],
  payload: PushNotificationPayload,
): Promise<{ successCount: number; failureCount: number }> => {
  if (!firebaseInitialized) {
    logger.warn('Firebase not initialized, cannot send push notifications');
    return { successCount: 0, failureCount: fcmTokens.length };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.icon || `${ENV.BASE_URL}/fairArenaLogotop.png`,
      },
      data: payload.data || {},
      webpush: {
        fcmOptions: {
          link: `${ENV.FRONTEND_URL}/dashboard/inbox`,
        },
        notification: {
          icon: payload.icon || `${ENV.BASE_URL}/fairArenaLogotop.png`,
          badge: `${ENV.BASE_URL}/fairArenaLogotop.png`,
          requireInteraction: false,
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info('Multicast push notifications sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Clean up invalid tokens
    if (response.failureCount > 0 && response.responses) {
      const tokensToCleanup: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            tokensToCleanup.push(fcmTokens[idx]);
          }
        }
      });

      // Clean up invalid tokens asynchronously
      if (tokensToCleanup.length > 0) {
        Promise.all(tokensToCleanup.map((token) => cleanupInvalidToken(token))).catch((err) => {
          logger.error('Error cleaning up invalid tokens', { error: err });
        });
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error('Error sending multicast push notifications', { error });
    return { successCount: 0, failureCount: fcmTokens.length };
  }
};

export default {
  sendPushNotification,
  sendMulticastPushNotification,
  cleanupInvalidToken,
  sendSmartNotification,
};

/**
 * Send notification with smart device routing
 * This is the main function that should be used for sending notifications
 */
export async function sendSmartNotification(
  userId: string,
  payload: PushNotificationPayload,
  options: {
    sendToAll?: boolean;
    priority?: 'high' | 'normal';
  } = {},
): Promise<BatchPushResult> {
  try {
    // Check rate limits
    const rateLimitResult = await checkNotificationRateLimit(userId);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for user', {
        userId,
        resetAt: rateLimitResult.resetAt,
      });
      return {
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
        results: [],
      };
    }

    // Get smart device routing
    const devices = await getSmartDeviceRouting(userId, options.sendToAll);

    if (devices.length === 0) {
      logger.info('No active devices found for user', { userId });
      return {
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
        results: [],
      };
    }

    // Extract tokens
    const tokens = devices.map((d) => d.token);

    // Send to all selected devices
    const result = await sendMulticastPushNotification(tokens, {
      ...payload,
      priority: options.priority || 'high',
    });

    // Update token usage for successful sends
    const successfulDevices = devices.slice(0, result.successCount);
    await Promise.all(successfulDevices.map((device) => updateTokenUsage(device.token, true)));

    logger.info('Smart notification sent', {
      userId,
      devicesTargeted: devices.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });

    return {
      ...result,
      failedTokens: tokens.slice(result.successCount),
      results: devices.map((device, idx) => ({
        token: device.token,
        success: idx < result.successCount,
        error: idx >= result.successCount ? 'Failed to send' : undefined,
      })),
    };
  } catch (error) {
    logger.error('Error sending smart notification', { error, userId });
    return {
      successCount: 0,
      failureCount: 0,
      failedTokens: [],
      results: [],
    };
  }
}
