import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { getRedirectPath } from '../../utils/navigation';

interface QRAuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface QRSession {
    sessionId: string;
    qrData: string;
    expiresAt: number;
    ttl: number;
}

type QRStatus = 'loading' | 'pending' | 'approved' | 'claimed' | 'expired' | 'error';

export function QRAuthDialog({ open, onOpenChange }: QRAuthDialogProps) {
    const { isDark } = useTheme();
    const location = useLocation();

    const [status, setStatus] = useState<QRStatus>('loading');
    const [session, setSession] = useState<QRSession | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const apiUrl = import.meta.env.VITE_API_BASE_URL;

    // Cleanup function
    const cleanup = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Generate QR session
    const generateSession = useCallback(async () => {
        cleanup();
        setStatus('loading');
        setErrorMessage(null);
        setSession(null);

        try {
            const res = await fetch(`${apiUrl}/api/v1/auth/qr/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    setErrorMessage(`Too many requests. Try again in ${data.retryAfter || 60} seconds.`);
                    setStatus('error');
                    return;
                }
                throw new Error(data.message || 'Failed to generate QR code');
            }

            if (data.success) {
                setSession(data.data);
                setTimeLeft(data.data.ttl);
                setStatus('pending');
                startStatusStream(data.data.sessionId);
            }
        } catch (error) {
            console.error('QR Generate Error:', error);
            setErrorMessage('Failed to generate QR code. Please try again.');
            setStatus('error');
            toast.error('Failed to generate QR code');
        }
    }, [apiUrl, cleanup]);

    // Start SSE stream for real-time status
    const startStatusStream = useCallback((sessionId: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const sse = new EventSource(`${apiUrl}/api/v1/auth/qr/status/${sessionId}`);
        eventSourceRef.current = sse;

        sse.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'expired') {
                    setStatus('expired');
                    sse.close();
                    return;
                }

                if (data.status === 'approved' && data.nonce) {
                    setStatus('approved');
                    sse.close();
                    await claimSession(sessionId, data.nonce);
                }
            } catch (err) {
                console.error('SSE Parse Error:', err);
            }
        };

        sse.onerror = () => {
            sse.close();
            // Don't set error state - might just be connection closed
        };
    }, [apiUrl]);

    // Claim the approved session
    const claimSession = async (sessionId: string, nonce: string) => {
        try {
            const res = await fetch(`${apiUrl}/api/v1/auth/qr/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sessionId, nonce }),
            });

            const data = await res.json();

            if (data.success) {
                setStatus('claimed');
                toast.success('Signed in successfully!');

                // Small delay for visual feedback
                setTimeout(() => {
                    onOpenChange(false);
                    sessionStorage.removeItem('auth_flow');
                    window.location.href = getRedirectPath(location);
                }, 800);
            } else {
                toast.error(data.message || 'Failed to complete sign in');
                setStatus('error');
                setErrorMessage(data.message || 'Failed to complete sign in');
            }
        } catch (error) {
            console.error('Claim Error:', error);
            toast.error('Failed to complete sign in');
            setStatus('error');
            setErrorMessage('Connection error. Please try again.');
        }
    };

    // Initialize on open
    useEffect(() => {
        if (open) {
            generateSession();
        } else {
            cleanup();
            setStatus('loading');
            setSession(null);
        }

        return cleanup;
    }, [open, generateSession, cleanup]);

    // Countdown timer
    useEffect(() => {
        if (!session || status !== 'pending') return;

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
    }, [session, status, cleanup]);

    // Progress percentage for circular indicator
    const progressPercent = session ? (timeLeft / session.ttl) * 100 : 100;
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={`sm:max-w-[400px] p-0 overflow-hidden ${isDark
                    ? 'bg-neutral-900 border-neutral-800'
                    : 'bg-white border-neutral-200'
                    }`}
            >
                {/* Header */}
                <DialogHeader className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#DDEF00]/10' : 'bg-[#DDEF00]/10'
                            }`}>
                            <svg className="w-5 h-5 text-[#DDEF00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <div>
                            <DialogTitle className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                Sign in with QR Code
                            </DialogTitle>
                            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                Scan with your phone to sign in
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="px-6 py-8">
                    <div className="flex flex-col items-center">

                        {/* Loading State */}
                        {status === 'loading' && (
                            <div className="w-[220px] h-[220px] flex items-center justify-center">
                                <div className={`w-full h-full rounded-2xl ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'} animate-pulse flex items-center justify-center`}>
                                    <div className="w-8 h-8">
                                        <svg className="animate-spin text-[#DDEF00]" viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {status === 'error' && (
                            <div className="w-[220px] text-center">
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'
                                    }`}>
                                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    {errorMessage || 'Something went wrong'}
                                </p>
                                <button
                                    onClick={generateSession}
                                    className="px-6 py-2.5 bg-[#DDEF00] text-black font-semibold rounded-xl hover:bg-[#c7db00] transition-all active:scale-[0.98]"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* Expired State */}
                        {status === 'expired' && (
                            <div className="w-[220px] text-center">
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'
                                    }`}>
                                    <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                    QR Code Expired
                                </p>
                                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                    Generate a new code to continue
                                </p>
                                <button
                                    onClick={generateSession}
                                    className="px-6 py-2.5 bg-[#DDEF00] text-black font-semibold rounded-xl hover:bg-[#c7db00] transition-all active:scale-[0.98]"
                                >
                                    Get New Code
                                </button>
                            </div>
                        )}

                        {/* QR Code Display */}
                        {(status === 'pending' || status === 'approved' || status === 'claimed') && session && (
                            <div className="relative">
                                {/* Circular Progress Ring */}
                                {status === 'pending' && (
                                    <svg className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] -rotate-90">
                                        <circle
                                            cx="50%"
                                            cy="50%"
                                            r="45%"
                                            fill="none"
                                            stroke={isDark ? '#262626' : '#e5e5e5'}
                                            strokeWidth="3"
                                        />
                                        <circle
                                            cx="50%"
                                            cy="50%"
                                            r="45%"
                                            fill="none"
                                            stroke={timeLeft < 10 ? '#ef4444' : '#DDEF00'}
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                            className="transition-all duration-1000 ease-linear"
                                        />
                                    </svg>
                                )}

                                {/* QR Container */}
                                <div className={`relative p-4 rounded-2xl ${isDark ? 'bg-white' : 'bg-white shadow-lg'}`}>
                                    <QRCodeSVG
                                        value={session.qrData}
                                        size={180}
                                        level="H"
                                        includeMargin={false}
                                        imageSettings={{
                                            src: 'https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png',
                                            height: 36,
                                            width: 36,
                                            excavate: true,
                                        }}
                                    />

                                    {/* Success Overlay */}
                                    {(status === 'approved' || status === 'claimed') && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl">
                                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-3 animate-scale-in">
                                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-green-600 font-bold text-lg">
                                                {status === 'claimed' ? 'Signed In!' : 'Approved!'}
                                            </p>
                                            <p className="text-neutral-500 text-sm">
                                                {status === 'claimed' ? 'Redirecting...' : 'Completing sign in...'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Timer Display */}
                        {status === 'pending' && (
                            <div className="mt-6 text-center">
                                <p className={`text-sm font-medium tabular-nums ${timeLeft < 10
                                    ? 'text-red-500'
                                    : isDark ? 'text-neutral-300' : 'text-neutral-600'
                                    }`}>
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${isDark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-100 bg-neutral-50/50'}`}>
                    <div className={`flex items-start gap-3 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>
                            Open the FairArena app on your signed-in device and scan this code to sign in on this device.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
