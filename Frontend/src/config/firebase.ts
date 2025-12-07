import { type Analytics, getAnalytics } from 'firebase/analytics';
import { type Messaging } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;

try {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error('Firebase messaging initialization error:', error);
}

let analytics: Analytics | null = null;

export const initializeFirebaseAnalytics = (): Analytics | null => {
  if (typeof window !== 'undefined' && !analytics) {
    try {
      analytics = getAnalytics(app);
      return analytics;
    } catch (error) {
      console.warn('Failed to initialize Firebase Analytics:', error);
      return null;
    }
  }
  return analytics;
};

export const getFirebaseAnalytics = (): Analytics | null => {
  return analytics;
};

export { analytics, getToken, messaging, onMessage };
