import admin from 'firebase-admin';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';

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
  data?: Record<string, string>;
}

interface PushNotificationResult {
  success: boolean;
  error?: string;
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
  } catch (error: any) {
    logger.error('Error sending push notification', { error, fcmToken });

    // Handle invalid token errors
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      return { success: false, error: 'Invalid or expired FCM token' };
    }

    return { success: false, error: error.message || 'Failed to send notification' };
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
};
