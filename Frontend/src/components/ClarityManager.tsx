import Clarity from '@microsoft/clarity';
import { useEffect, useRef } from 'react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useDataSaverUtils } from '../hooks/useDataSaverUtils';

export function ClarityManager() {
    const { dataSaverSettings } = useDataSaverUtils();
    const { consentSettings, hasConsented } = useCookieConsent();
    const isInitializedRef = useRef(false);

    useEffect(() => {
        const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;

        if (!projectId) {
            console.warn('Clarity project ID not found');
            return;
        }

        // Don't initialize if user hasn't consented yet
        if (!hasConsented) {
            return;
        }

        // If data saver is enabled OR analytics consent is denied, stop/disable Clarity
        if (dataSaverSettings.enabled || !consentSettings?.analytics) {
            if (isInitializedRef.current) {
                console.log('Data saver enabled or analytics consent denied: Stopping Clarity monitoring');
                try {
                    Clarity.consent(false);
                    isInitializedRef.current = false;
                } catch (error) {
                    console.warn('Failed to stop Clarity:', error);
                }
            }
            return;
        }

        // If data saver is disabled AND analytics consent is given, initialize Clarity
        if (!dataSaverSettings.enabled && consentSettings?.analytics && !isInitializedRef.current) {
            try {
                Clarity.init(projectId);
                Clarity.consent(true);
                isInitializedRef.current = true;
                console.log('Clarity monitoring initialized with user consent');
            } catch (error) {
                console.warn('Failed to initialize Clarity:', error);
            }
        }
    }, [dataSaverSettings.enabled, consentSettings?.analytics, hasConsented]);

    return null; // This component doesn't render anything
}
