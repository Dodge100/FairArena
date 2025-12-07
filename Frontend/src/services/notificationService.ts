import axios from 'axios';
import { getToken, messaging, onMessage } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
  deviceId?: string;
  error?: string;
}

/**
 * Generate a unique device ID based on browser characteristics
 */
function generateDeviceId(): string {
  const nav = navigator as any;
  const screen = window.screen;

  const components = [
    nav.userAgent || '',
    nav.language || '',
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.platform || '',
  ];

  const fingerprintString = components.join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `device_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

/**
 * Get or create device ID
 */
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

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
 * Save FCM token to backend with device info and store in localStorage
 */
export const saveFCMToken = async (token: string, authToken: string): Promise<boolean> => {
  try {
    const deviceId = getDeviceId();

    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/fcm-token`,
      { token, deviceId },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        withCredentials: true,
      },
    );

    if (response.data.success) {
      // Store token and device ID in localStorage
      localStorage.setItem('fcm_token', token);
      localStorage.setItem('device_id', response.data.deviceId || deviceId);
    }

    return response.data.success;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return false;
  }
};

/**
 * Remove FCM token from backend
 * @param authToken - Authentication token
 * @param specificToken - Optional specific token to remove. If not provided, removes current device token
 */
export const removeFCMToken = async (
  authToken: string,
  specificToken?: string,
): Promise<boolean> => {
  try {
    // Get token and device ID from localStorage if not provided
    const tokenToRemove = specificToken || localStorage.getItem('fcm_token');
    const deviceId = getDeviceId();

    const response = await axios.delete(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/fcm-token`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: tokenToRemove ? { token: tokenToRemove, deviceId } : { deviceId },
        withCredentials: true,
      },
    );

    if (response.data.success) {
      // Remove token from localStorage only if we removed current device token
      if (!specificToken) {
        localStorage.removeItem('fcm_token');
      }
    }

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

/**
 * Get the current device's FCM token from localStorage
 */
export const getCurrentDeviceFCMToken = (): string | null => {
  return localStorage.getItem('fcm_token');
};

/**
 * Clear the current device's FCM token from localStorage
 */
export const clearCurrentDeviceFCMToken = (): void => {
  localStorage.removeItem('fcm_token');
};

/**
 * Send presence heartbeat to server
 */
export const sendPresenceHeartbeat = async (authToken: string): Promise<void> => {
  try {
    const deviceId = getDeviceId();

    await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/presence/heartbeat`,
      { deviceId },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        withCredentials: true,
      },
    );
  } catch (error) {
    console.error('Error sending presence heartbeat:', error);
  }
};

/**
 * Start presence heartbeat interval
 */
export const startPresenceHeartbeat = (authToken: string): (() => void) => {
  // Send initial heartbeat
  sendPresenceHeartbeat(authToken);

  // Set up interval
  const intervalId = setInterval(() => {
    sendPresenceHeartbeat(authToken);
  }, HEARTBEAT_INTERVAL);

  // Return cleanup function
  return () => clearInterval(intervalId);
};

/**
 * Update user presence status
 */
export const updatePresence = async (authToken: string, isOnline: boolean): Promise<void> => {
  try {
    const deviceId = getDeviceId();

    await axios.put(
      `${import.meta.env.VITE_API_BASE_URL}/api/v1/presence`,
      { deviceId, isOnline },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        withCredentials: true,
      },
    );
  } catch (error) {
    console.error('Error updating presence:', error);
  }
};
