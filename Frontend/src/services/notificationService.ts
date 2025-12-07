import axios from 'axios';
import { getToken, messaging, onMessage } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
  error?: string;
}

/**
 * Request notification permission from the browser
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionResult> => {
  try {
    if (!('Notification' in window)) {
      return { granted: false, error: 'Browser does not support notifications' };
    }

    if (!messaging) {
      return { granted: false, error: 'Firebase messaging not initialized' };
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });

      if (token) {
        return { granted: true, token };
      } else {
        return { granted: false, error: 'No registration token available' };
      }
    } else {
      return { granted: false, error: 'Permission denied' };
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return { granted: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Save FCM token to backend
 */
export const saveFCMToken = async (token: string, authToken: string): Promise<boolean> => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/fcm-token`,
      { token },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        withCredentials: true,
      },
    );

    return response.data.success;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return false;
  }
};

/**
 * Remove FCM token from backend
 */
export const removeFCMToken = async (authToken: string): Promise<boolean> => {
  try {
    const response = await axios.delete(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/fcm-token`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        withCredentials: true,
      },
    );

    return response.data.success;
  } catch (error) {
    console.error('Error removing FCM token:', error);
    return false;
  }
};

/**
 * Setup foreground message listener
 */
export const setupForegroundMessageListener = (callback: (payload: any) => void): (() => void) => {
  if (!messaging) {
    console.warn('Firebase messaging not initialized');
    return () => {};
  }

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });

  return unsubscribe;
};

/**
 * Check if notifications are supported
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermissionStatus = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};
