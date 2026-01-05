import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        google: any;
    }
}

export function GoogleOneTap() {
    const { loginWithGoogle, isAuthenticated, isLoading } = useAuth();
    // Client ID retrieved from backend .env, ideally should be in VITE_GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "483121858964-1v8qoubd8c3urnfn7gja33cgcjkv8pqg.apps.googleusercontent.com";

    useEffect(() => {
        // Don't show if already authenticated or loading
        if (isAuthenticated || isLoading) return;

        // Check if script is already present
        const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

        // Function to initialize One Tap
        const initializeOneTap = () => {
            if (!window.google) return;

            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response: any) => {
                    if (response.credential) {
                        const toastId = toast.loading('Signing in with Google...');
                        try {
                            await loginWithGoogle(response.credential);
                            toast.success('Signed in successfully!', { id: toastId });
                        } catch (error) {
                            console.error('One Tap login failed', error);
                            toast.error('Failed to sign in with Google', { id: toastId });
                        }
                    }
                },
                auto_select: false, // Don't automatically sign in, let user choose
                cancel_on_tap_outside: false, // Standard behavior
            });

            window.google.accounts.id.prompt((notification: any) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    console.debug("One Tap skipped/not displayed:", notification.getNotDisplayedReason());
                }
            });
        };

        if (existingScript) {
            initializeOneTap();
        } else {
            const script = document.createElement('script');
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
            script.onload = initializeOneTap;
        }

    }, [isAuthenticated, isLoading, loginWithGoogle, GOOGLE_CLIENT_ID]);

    return null;
}
