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

import { useEffect, useRef } from 'react';
import { initializeFirebaseAnalytics } from '../config/firebase';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useDataSaverUtils } from '../hooks/useDataSaverUtils';

export function FirebaseAnalyticsManager() {
  const { dataSaverSettings } = useDataSaverUtils();
  const { consentSettings, hasConsented } = useCookieConsent();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Don't initialize if user hasn't consented yet
    if (!hasConsented) {
      return;
    }

    // If data saver is enabled OR analytics consent is denied, stop/disable Firebase Analytics
    if (dataSaverSettings.enabled || !consentSettings?.analytics) {
      if (isInitializedRef.current) {
        try {
          isInitializedRef.current = false;
        } catch (error) {
          console.warn('Failed to stop Firebase Analytics:', error);
        }
      }
      return;
    }

    // If data saver is disabled AND analytics consent is given, initialize Firebase Analytics
    if (!dataSaverSettings.enabled && consentSettings?.analytics && !isInitializedRef.current) {
      try {
        const analytics = initializeFirebaseAnalytics();
        if (analytics) {
          isInitializedRef.current = true;
        }
      } catch (error) {
        console.warn('Failed to initialize Firebase Analytics:', error);
      }
    }
  }, [dataSaverSettings.enabled, consentSettings?.analytics, hasConsented]);

  return null; // This component doesn't render anything
}
