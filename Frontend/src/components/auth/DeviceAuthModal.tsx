import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { publicApiFetch } from '@/lib/apiClient';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { getRedirectPath } from '../../utils/navigation';

interface DeviceAuthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

interface DeviceAuthData {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}

type DeviceAuthStatus = 'loading' | 'pending' | 'authorized' | 'denied' | 'expired' | 'error';

export function DeviceAuthModal({ open, onOpenChange, onSuccess }: DeviceAuthModalProps) {
    const { isDark } = useTheme();
    const location = useLocation();

    const [status, setStatus] = useState<DeviceAuthStatus>('loading');
    const [deviceData, setDeviceData] = useState<DeviceAuthData | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollIntervalRef = useRef(5); // Default 5 seconds
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    const clientId = import.meta.env.VITE_OAUTH_DEVICE_CLIENT_ID || 'fairarena-web';

    // Cleanup function
    const cleanup = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Initiate device authorization
    const initiateDeviceAuth = useCallback(async () => {
        setStatus('loading');
        setErrorMessage(null);
        setDeviceData(null);

        try {
            const response = await publicApiFetch(`${apiUrl}/api/v1/oauth/device/authorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    scope: 'openid profile email offline_access',
                }).toString(),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Too many requests. Please try again later.');
                }
                throw new Error(
                    data.error_description || data.message || 'Failed to initiate device authorization',
                );
            }

            setDeviceData(data);
            setTimeLeft(data.expires_in);
            setStatus('pending');
            pollIntervalRef.current = data.interval || 5;
            startPolling(data.device_code);
        } catch (error) {
            console.error('Device Auth Error:', error);
            const message =
                error instanceof Error ? error.message : 'Failed to initiate device authorization';
            setErrorMessage(message);
            setStatus('error');
            toast.error(message);
        }
    }, [apiUrl, clientId]);

    // Poll for authorization status
    const pollAuthStatus = useCallback(
        async (deviceCode: string) => {
            try {
                const response = await publicApiFetch(`${apiUrl}/api/v1/oauth/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        device_code: deviceCode,
                        client_id: clientId,
                    }).toString(),
                });

                const data = await response.json();

                if (response.ok && data.access_token) {
                    // Success! Authorization complete
                    setStatus('authorized');
                    cleanup();

                    try {
                        // Exchange OAuth token for session cookie
                        const sessionResponse = await publicApiFetch(`${apiUrl}/api/v1/auth/oauth/session`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                access_token: data.access_token,
                            }),
                        });

                        if (!sessionResponse.ok) {
                            const sessionError = await sessionResponse.json();
                            throw new Error(sessionError.message || 'Failed to create session');
                        }

                        toast.success('Device authorized successfully!');

                        // Small delay for visual feedback
                        setTimeout(() => {
                            onOpenChange(false);
                            sessionStorage.removeItem('auth_flow');
                            sessionStorage.removeItem('oauth_request_id');
                            if (onSuccess) {
                                onSuccess();
                            } else {
                                window.location.href = getRedirectPath(location);
                            }
                        }, 800);
                    } catch (sessionError) {
                        console.error('Session exchange error:', sessionError);
                        setStatus('error');
                        setErrorMessage(sessionError instanceof Error ? sessionError.message : 'Failed to create session');
                        toast.error('Failed to complete sign-in. Please try again.');
                    }
                    return;
                }

                // Handle errors
                if (data.error) {
                    switch (data.error) {
                        case 'authorization_pending':
                            // Still waiting, continue polling
                            break;
                        case 'slow_down':
                            // Increase polling interval
                            pollIntervalRef.current += 5;
                            toast.warning('Polling too fast, slowing down...');
                            break;
                        case 'access_denied':
                            setStatus('denied');
                            cleanup();
                            setErrorMessage('Authorization was denied');
                            toast.error('Authorization denied');
                            break;
                        case 'expired_token':
                            setStatus('expired');
                            cleanup();
                            setErrorMessage('Device code has expired');
                            break;
                        default:
                            setStatus('error');
                            cleanup();
                            setErrorMessage(data.error_description || 'Authorization failed');
                            toast.error(data.error_description || 'Authorization failed');
                    }
                }
            } catch (error) {
                console.error('Polling Error:', error);
                // Don't stop polling on network errors, just log
            }
        },
        [apiUrl, clientId, cleanup, location, onOpenChange, onSuccess],
    );

    // Start polling
    const startPolling = useCallback(
        (deviceCode: string) => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }

            // Wait for the interval before first poll to avoid "slow_down" error
            setTimeout(() => {
                pollAuthStatus(deviceCode);

                // Then poll at regular intervals
                pollingRef.current = setInterval(() => {
                    pollAuthStatus(deviceCode);
                }, pollIntervalRef.current * 1000);
            }, pollIntervalRef.current * 1000);
        },
        [pollAuthStatus],
    );

    // Copy code to clipboard
    const copyCode = useCallback(() => {
        if (deviceData?.user_code) {
            navigator.clipboard.writeText(deviceData.user_code);
            setCopied(true);
            toast.success('Code copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
    }, [deviceData]);

    // Copy URL to clipboard
    const copyUrl = useCallback(() => {
        if (deviceData?.verification_uri_complete) {
            navigator.clipboard.writeText(deviceData.verification_uri_complete);
            toast.success('URL copied to clipboard');
        }
    }, [deviceData]);

    // Initialize on open
    useEffect(() => {
        if (open) {
            initiateDeviceAuth();
        } else {
            cleanup();
            setStatus('loading');
            setDeviceData(null);
            setCopied(false);
        }

        return cleanup;
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Countdown timer
    useEffect(() => {
        if (!deviceData || status !== 'pending') return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    setStatus('expired');
                    cleanup();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [deviceData, status, cleanup]);

    // Format time display
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={`sm:max-w-[450px] max-h-[80vh] !flex !flex-col p-0 overflow-hidden ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
                    }`}
            >
                {/* Header */}
                <DialogHeader
                    className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-100'}`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#DDEF00]/10' : 'bg-[#DDEF00]/10'
                                }`}
                        >
                            <svg
                                className="w-5 h-5 text-[#DDEF00]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div>
                            <DialogTitle
                                className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}
                            >
                                Device Authorization
                            </DialogTitle>
                            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                Sign in from another device
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="px-6 py-8 overflow-y-auto flex-1 min-h-0">
                    <div className="flex flex-col items-center">
                        {/* Loading State */}
                        {status === 'loading' && (
                            <div className="w-[240px] h-[240px] flex items-center justify-center">
                                <div
                                    className={`w-full h-full rounded-2xl ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'} animate-pulse flex items-center justify-center`}
                                >
                                    <div className="w-8 h-8">
                                        <svg className="animate-spin text-[#DDEF00]" viewBox="0 0 24 24" fill="none">
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeOpacity="0.2"
                                            />
                                            <path
                                                d="M12 2a10 10 0 0 1 10 10"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {status === 'error' && (
                            <div className="w-full text-center">
                                <div
                                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'
                                        }`}
                                >
                                    <svg
                                        className="w-8 h-8 text-red-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                        />
                                    </svg>
                                </div>
                                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {errorMessage || 'Something went wrong'}
                                </p>
                                <button
                                    onClick={initiateDeviceAuth}
                                    className="px-6 py-2.5 bg-[#DDEF00] text-black font-semibold rounded-xl hover:bg-[#c7db00] transition-all active:scale-[0.98]"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* Denied State */}
                        {status === 'denied' && (
                            <div className="w-full text-center">
                                <div
                                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'
                                        }`}
                                >
                                    <svg
                                        className="w-8 h-8 text-red-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                    Authorization Denied
                                </p>
                                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    You denied the authorization request
                                </p>
                                <button
                                    onClick={initiateDeviceAuth}
                                    className="px-6 py-2.5 bg-[#DDEF00] text-black font-semibold rounded-xl hover:bg-[#c7db00] transition-all active:scale-[0.98]"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* Expired State */}
                        {status === 'expired' && (
                            <div className="w-full text-center">
                                <div
                                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'
                                        }`}
                                >
                                    <svg
                                        className="w-8 h-8 text-orange-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                    Code Expired
                                </p>
                                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    Generate a new code to continue
                                </p>
                                <button
                                    onClick={initiateDeviceAuth}
                                    className="px-6 py-2.5 bg-[#DDEF00] text-black font-semibold rounded-xl hover:bg-[#c7db00] transition-all active:scale-[0.98]"
                                >
                                    Get New Code
                                </button>
                            </div>
                        )}

                        {/* Pending/Authorized State */}
                        {(status === 'pending' || status === 'authorized') && deviceData && (
                            <div className="w-full space-y-6">
                                {/* QR Code */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        <div
                                            className={`relative p-4 rounded-2xl ${isDark ? 'bg-white' : 'bg-white shadow-lg'}`}
                                        >
                                            <QRCodeSVG
                                                value={deviceData.verification_uri_complete}
                                                size={200}
                                                level="H"
                                                includeMargin={false}
                                                imageSettings={{
                                                    src: 'https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin',
                                                    height: 40,
                                                    width: 40,
                                                    excavate: true,
                                                }}
                                            />

                                            {/* Success Overlay */}
                                            {status === 'authorized' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl">
                                                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-3 animate-scale-in">
                                                        <svg
                                                            className="w-8 h-8 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <p className="text-green-600 font-bold text-lg">Authorized!</p>
                                                    <p className="text-neutral-500 text-sm">Signing you in...</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* User Code Display */}
                                <div className="text-center">
                                    <p
                                        className={`text-sm font-medium mb-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                                    >
                                        Or enter this code:
                                    </p>
                                    <div
                                        className={`relative inline-flex items-center gap-3 px-6 py-4 rounded-xl border-2 ${isDark
                                            ? 'bg-neutral-800 border-neutral-700'
                                            : 'bg-neutral-50 border-neutral-200'
                                            }`}
                                    >
                                        <span
                                            className={`text-3xl font-bold tracking-wider font-mono ${isDark ? 'text-white' : 'text-neutral-900'
                                                }`}
                                        >
                                            {deviceData.user_code}
                                        </span>
                                        <button
                                            onClick={copyCode}
                                            className={`p-2 rounded-lg transition-all hover:scale-110 ${copied
                                                ? 'bg-green-500/20 text-green-500'
                                                : isDark
                                                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                    : 'bg-white text-neutral-600 hover:bg-neutral-100'
                                                }`}
                                            title="Copy code"
                                        >
                                            {copied ? (
                                                <svg
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg
                                                    className="w-5 h-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* URL Display */}
                                <div className={`p-4 rounded-xl ${isDark ? 'bg-neutral-800/50' : 'bg-neutral-50'}`}>
                                    <p
                                        className={`text-xs font-medium mb-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                                    >
                                        Or visit this URL (code auto-filled):
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code
                                            className={`flex-1 text-xs break-all ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                                        >
                                            {deviceData.verification_uri_complete}
                                        </code>
                                        <button
                                            onClick={copyUrl}
                                            className={`p-1.5 rounded-lg transition-all hover:scale-110 shrink-0 ${isDark
                                                ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                : 'bg-white text-neutral-600 hover:bg-neutral-100'
                                                }`}
                                            title="Copy URL"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Timer and Status */}
                                {status === 'pending' && (
                                    <div className="text-center space-y-3">
                                        <div
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${timeLeft < 60
                                                ? 'bg-red-500/10 text-red-500'
                                                : isDark
                                                    ? 'bg-neutral-800 text-neutral-300'
                                                    : 'bg-neutral-100 text-neutral-700'
                                                }`}
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            <span className="text-sm font-medium tabular-nums">
                                                Expires in {formatTime(timeLeft)}
                                            </span>
                                        </div>
                                        <div
                                            className={`flex items-center justify-center gap-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                                        >
                                            <div className="flex gap-1">
                                                <div
                                                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                                                    style={{ animationDelay: '0ms' }}
                                                ></div>
                                                <div
                                                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                                                    style={{ animationDelay: '150ms' }}
                                                ></div>
                                                <div
                                                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                                                    style={{ animationDelay: '300ms' }}
                                                ></div>
                                            </div>
                                            <p className="text-xs font-medium">
                                                Waiting for you to authorize on your other device
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    className={`px-6 py-4 border-t ${isDark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-100 bg-neutral-50/50'} shrink-0`}
                >
                    <div
                        className={`flex items-start gap-3 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}
                    >
                        <svg
                            className="w-4 h-4 shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p>
                            Scan the QR code or visit the URL on a device where you're already signed in to
                            FairArena to authorize this device.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
