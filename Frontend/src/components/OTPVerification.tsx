import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@clerk/clerk-react';
import { CheckCircle, Clock, Loader2, Mail, Shield, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        grecaptcha: {
            ready: (cb: () => void) => void;
            render: (container: string | HTMLElement, parameters: { sitekey: string; size?: 'invisible' | 'compact' | 'normal' }) => number;
            execute: (widgetIdOrSiteKey: number | string, options?: { action?: string }) => Promise<string>;
            getResponse: (widgetId?: number) => string;
            reset: (widgetId?: number) => void;
        };
        onRecaptchaLoad?: () => void;
    }
}

interface OTPVerificationProps {
    onVerified: () => void;
    title?: string;
    description?: string;
}

export function OTPVerification({
    onVerified,
    title = "Account Verification",
    description = "Verify your account to access sensitive settings. Verification expires in 10 minutes."
}: OTPVerificationProps) {
    const { getToken } = useAuth();
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [otp, setOtp] = useState('');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [message, setMessage] = useState('');
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);
    const recaptchaWidgetId = useRef<number | null>(null);
    const [captchaCompleted, setCaptchaCompleted] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);

    // Cooldown state
    const [lastOtpRequestTime, setLastOtpRequestTime] = useState<number>(0);
    const [otpCooldown, setOtpCooldown] = useState<number>(0);

    const checkVerificationStatus = useCallback(async () => {
        try {
            const token = await getToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/status`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: 'include',
                },
            );
            const data = await res.json();
            if (data.success && data.verified) {
                setIsVerified(true);
                onVerified();
            } else {
                setIsVerified(false);
            }
        } catch (error) {
            console.error('Verification check failed:', error);
            setIsVerified(false);
        } finally {
            setIsVerifying(false);
        }
    }, [getToken, onVerified]);

    useEffect(() => {
        checkVerificationStatus();
    }, [checkVerificationStatus]);

    // Countdown timer for rate limiting
    useEffect(() => {
        let interval: number;
        if (isRateLimited && retryAfter > 0) {
            interval = setInterval(() => {
                setRetryAfter((prev) => {
                    if (prev <= 1) {
                        setIsRateLimited(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRateLimited, retryAfter]);

    // OTP cooldown timer (1 minute)
    useEffect(() => {
        let interval: number;
        if (otpCooldown > 0) {
            interval = setInterval(() => {
                setOtpCooldown((prev) => {
                    if (prev <= 1) return 0;
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [otpCooldown]);

    // Load Google reCAPTCHA v2 script
    useEffect(() => {
        const siteKey = import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY;
        if (!siteKey) {
            console.warn('Missing VITE_GOOGLE_RECAPTCHA_SITE_KEY env');
            return;
        }

        if (typeof window === 'undefined') return;

        // Check if script already exists
        const existing = document.querySelector('script[data-grecaptcha]');
        if (existing) {
            // Script exists, check if grecaptcha is ready
            if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
                setScriptLoaded(true);
            } else {
                // Wait for it to load with timeout
                const checkInterval = setInterval(() => {
                    if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
                        setScriptLoaded(true);
                        clearInterval(checkInterval);
                    }
                }, 100);
                const timeout = setTimeout(() => {
                    clearInterval(checkInterval);
                    console.error('reCAPTCHA script load timeout');
                }, 10000);
                return () => {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                };
            }
            return;
        }

        // Create and load script
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onRecaptchaLoad';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-grecaptcha', 'true');

        window.onRecaptchaLoad = () => {
            setScriptLoaded(true);
        };

        script.onerror = () => {
            console.error('Failed to load reCAPTCHA script');
        };
        document.body.appendChild(script);
        return () => {
            delete window.onRecaptchaLoad;
        };
    }, []);

    // Render reCAPTCHA widget when script is loaded and container is ready
    useEffect(() => {
        const siteKey = import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY;

        if (!scriptLoaded || !siteKey || !window.grecaptcha || !window.grecaptcha.render) {
            return;
        }

        if (!recaptchaContainerRef.current) {
            return;
        }

        // If widget already rendered, skip
        if (recaptchaWidgetId.current !== null) {
            return;
        }

        // Small delay to ensure DOM is fully ready
        const timeoutId = setTimeout(() => {
            if (!recaptchaContainerRef.current) return;

            try {
                window.grecaptcha.ready(() => {
                    if (!recaptchaContainerRef.current || recaptchaWidgetId.current !== null) return;

                    // Clear any existing content
                    recaptchaContainerRef.current.innerHTML = '';

                    interface RecaptchaRenderParameters {
                        sitekey: string;
                        size?: 'invisible' | 'compact' | 'normal';
                        callback?: () => void;
                        'expired-callback'?: () => void;
                        'error-callback'?: () => void;
                    }
                    const renderParams: RecaptchaRenderParameters = {
                        sitekey: siteKey,
                        size: 'normal',
                        callback: () => {
                            setCaptchaCompleted(true);
                        },
                        'expired-callback': () => {
                            setCaptchaCompleted(false);
                        },
                        'error-callback': () => {
                            console.error('reCAPTCHA error');
                            setCaptchaCompleted(false);
                        },
                    };
                    recaptchaWidgetId.current = window.grecaptcha.render(recaptchaContainerRef.current, renderParams);
                });
            } catch (e) {
                console.error('reCAPTCHA render error', e);
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [scriptLoaded, isVerified]);

    const getRecaptchaToken = async () => {
        if (recaptchaWidgetId.current === null || !window.grecaptcha) {
            setMessage('Please complete the CAPTCHA');
            return '';
        }
        const token = await window.grecaptcha.getResponse(recaptchaWidgetId.current);
        if (!token) {
            setMessage('Please complete the CAPTCHA');
            return '';
        }
        return token;
    };

    const sendOtp = async () => {
        // Check if cooldown is active
        const now = Date.now();
        const timeSinceLastRequest = (now - lastOtpRequestTime) / 1000;

        if (timeSinceLastRequest < 60 && lastOtpRequestTime > 0) {
            const remaining = Math.ceil(60 - timeSinceLastRequest);
            setOtpCooldown(remaining);
            setMessage(`Please wait ${remaining} seconds before requesting another OTP.`);
            return;
        }

        setIsSendingOtp(true);
        setMessage('');
        setIsRateLimited(false);
        setRetryAfter(0);

        try {
            const captcha = await getRecaptchaToken();
            if (!captcha) {
                setIsSendingOtp(false);
                return;
            }
            const token = await getToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/send-otp`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Recaptcha-Token': captcha,
                    },
                    credentials: 'include',
                },
            );
            const data = await res.json();

            if (res.status === 429) {
                setIsRateLimited(true);
                setRetryAfter(data.retryAfter || 1800);
                setMessage(data.message || 'Too many OTP requests. Please try again later.');
            } else if (data.success) {
                setMessage('OTP sent to your email successfully!');
                setIsRateLimited(false);
                setRetryAfter(0);
                setLastOtpRequestTime(now);
                setOtpCooldown(60);
                // Reset CAPTCHA to require re-verification for next request
                if (recaptchaWidgetId.current !== null && window.grecaptcha) {
                    window.grecaptcha.reset(recaptchaWidgetId.current);
                    setCaptchaCompleted(false);
                }
            } else if (res.status === 400 && data?.message?.toLowerCase().includes('captcha')) {
                setMessage(data.message || 'Captcha verification failed. Please retry.');
            } else {
                setMessage(data.message || 'Failed to send OTP');
            }
        } catch (error) {
            console.error('Send OTP failed:', error);
            setMessage('Failed to send OTP');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const verifyOtp = async () => {
        if (!otp.trim()) {
            setMessage('Please enter the OTP');
            return;
        }
        setIsVerifyingOtp(true);
        setMessage('');
        setIsRateLimited(false);
        setRetryAfter(0);

        try {
            const captcha = await getRecaptchaToken();
            if (!captcha) {
                setIsVerifyingOtp(false);
                return;
            }
            const token = await getToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/verify-otp`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                        'X-Recaptcha-Token': captcha,
                    },
                    body: JSON.stringify({ otp }),
                    credentials: 'include',
                },
            );
            const data = await res.json();

            if (res.status === 429) {
                setIsRateLimited(true);
                setRetryAfter(data.retryAfter || 900);
                setMessage(data.message || 'Too many attempts. Please try again later.');
            } else if (data.success) {
                setIsVerified(true);
                setMessage('Verification successful!');
                setOtp('');
                setIsRateLimited(false);
                setRetryAfter(0);
                onVerified();
                // Reset CAPTCHA after successful verify
                if (recaptchaWidgetId.current !== null && window.grecaptcha) {
                    window.grecaptcha.reset(recaptchaWidgetId.current);
                    setCaptchaCompleted(false);
                }
            } else if (res.status === 400 && data?.message?.toLowerCase().includes('captcha')) {
                setMessage(data.message || 'Captcha verification failed. Please retry.');
            } else {
                setMessage(data.message || 'Verification failed');
            }
        } catch (error) {
            console.error('Verify OTP failed:', error);
            setMessage('Verification failed');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    if (isVerifying) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking verification status...</span>
                </div>
            </div>
        );
    }

    if (isVerified) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    {isVerified ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span>{title}</span>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Verification Status:</span>
                    <Badge variant={isVerified ? 'default' : 'destructive'}>
                        {isVerified ? 'Verified' : 'Not Verified'}
                    </Badge>
                </div>

                {!isVerified && (
                    <>

                        <div className="space-y-2">
                            <label htmlFor="otp" className="text-sm font-medium">
                                Enter OTP
                            </label>
                            <Input
                                id="otp"
                                type="text"
                                placeholder="Enter 6 to 12 digits OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={12}
                                disabled={isRateLimited}
                            />
                            {/* Visible reCAPTCHA v2 checkbox */}
                            <div className="mb-3">
                                <div ref={recaptchaContainerRef} />
                            </div>
                            {isRateLimited && retryAfter > 0 && (
                                <div className="text-sm text-orange-600">
                                    Too many attempts. Try again in {Math.ceil(retryAfter / 60)} minutes.
                                </div>
                            )}
                            {otpCooldown > 0 && !isRateLimited && (
                                <div className="text-sm text-blue-600 flex items-center space-x-1">
                                    <Clock className="h-3 w-3" />
                                    <span>Next OTP request available in {otpCooldown} seconds</span>
                                </div>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                onClick={sendOtp}
                                disabled={
                                    isSendingOtp || isRateLimited || otpCooldown > 0 ||
                                    !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || !captchaCompleted
                                }
                                variant="default"
                                className="flex-1"
                            >
                                {isSendingOtp ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : isRateLimited ? (
                                    <XCircle className="h-4 w-4 mr-2" />
                                ) : otpCooldown > 0 ? (
                                    <Clock className="h-4 w-4 mr-2" />
                                ) : (
                                    <Mail className="h-4 w-4 mr-2" />
                                )}
                                {isSendingOtp
                                    ? 'Sending...'
                                    : isRateLimited
                                        ? 'Rate Limited'
                                        : otpCooldown > 0
                                            ? `Wait ${otpCooldown}s`
                                            : (!import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? 'Captcha not configured' : (!captchaCompleted ? 'Complete CAPTCHA' : 'Send OTP'))}
                            </Button>
                            <Button
                                onClick={verifyOtp}
                                disabled={
                                    isVerifyingOtp || isRateLimited ||
                                    !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || !captchaCompleted ||
                                    otp.trim().length < 6
                                }
                                className="flex-1"
                            >
                                {isVerifyingOtp ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Shield className="h-4 w-4 mr-2" />
                                )}
                                {isVerifyingOtp ? 'Verifying...' : (!import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? 'Captcha not configured' : (!captchaCompleted ? 'Complete CAPTCHA' : (otp.trim().length < 6 ? 'Enter 6+ digits' : 'Verify')))}
                            </Button>
                        </div>
                    </>
                )}

                {message && (
                    <div
                        className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {message}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
