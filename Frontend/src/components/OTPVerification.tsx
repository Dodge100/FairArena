import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, ChevronRight, Clock, Loader2, Lock, Mail, Shield, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTheme } from '../hooks/useTheme';
import { apiFetch } from '../lib/apiClient';

interface OTPVerificationProps {
  onVerified: () => void;
  title?: string;
  description?: string;
  className?: string;
  fullScreen?: boolean;
}

export function OTPVerification({
  onVerified,
  title = 'Account Verification',
  description = 'Verify your account to access sensitive settings. Verification expires in 10 minutes.',
  className = '',
  fullScreen = true,
}: OTPVerificationProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Cooldown state
  const [lastOtpRequestTime, setLastOtpRequestTime] = useState<number>(0);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);

  const checkVerificationStatus = useCallback(async () => {
    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/status`
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
  }, [onVerified]);

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

  const onCaptchaChange = useCallback((token: string | null) => {
    if (token && pendingAction) {
      setShowCaptchaModal(false);
      if (pendingAction === 'send') {
        executeSendOtp(token);
      } else if (pendingAction === 'verify') {
        executeVerifyOtp(token);
      }
      setPendingAction(null);
    }
  }, [pendingAction]);

  const onCaptchaExpired = useCallback(() => {
    // No-op
  }, []);

  const onCaptchaError = useCallback(() => {
    setMessage({ type: 'error', text: 'CAPTCHA verification failed. Please try again.' });
  }, []);

  const handleSendClick = () => {
    // Check cooldowns first
    const now = Date.now();
    const timeSinceLastRequest = (now - lastOtpRequestTime) / 1000;
    if (timeSinceLastRequest < 60 && lastOtpRequestTime > 0) {
      const remaining = Math.ceil(60 - timeSinceLastRequest);
      setOtpCooldown(remaining);
      setMessage({ type: 'error', text: `Please wait ${remaining} seconds before requesting another OTP.` });
      return;
    }

    setPendingAction('send');
    setShowCaptchaModal(true);
  };

  const handleVerifyClick = () => {
    if (!otp.trim() || otp.length < 6) {
      setMessage({ type: 'error', text: 'Please enter at least 6 characters for the OTP' });
      return;
    }
    setPendingAction('verify');
    setShowCaptchaModal(true);
  };

  const executeSendOtp = async (token: string) => {
    setIsSendingOtp(true);
    setMessage(null);
    setIsRateLimited(false);
    setRetryAfter(0);

    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/send-otp`,
        {
          method: 'POST',
          headers: {
            'X-Recaptcha-Token': token,
          },
        },
      );

      const data = await res.json();

      if (res.status === 429) {
        setIsRateLimited(true);
        setRetryAfter(data.retryAfter || 1800);
        setMessage({ type: 'error', text: data.message || 'Too many OTP requests. Please try again later.' });
      } else if (data.success) {
        setMessage({ type: 'success', text: 'OTP sent to your email successfully!' });
        setIsRateLimited(false);
        setRetryAfter(0);
        setLastOtpRequestTime(Date.now());
        setOtpCooldown(60);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to send OTP' });
      }
    } catch (error) {
      console.error('Send OTP failed:', error);
      setMessage({ type: 'error', text: 'Failed to send OTP' });
    } finally {
      setIsSendingOtp(false);
      if (recaptchaRef.current) recaptchaRef.current.reset();
    }
  };

  const executeVerifyOtp = async (token: string) => {
    setIsVerifyingOtp(true);
    setMessage(null);
    setIsRateLimited(false);
    setRetryAfter(0);

    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Recaptcha-Token': token,
          },
          body: JSON.stringify({ otp }),
          credentials: 'include',
        },
      );

      const data = await res.json();

      if (res.status === 429) {
        setIsRateLimited(true);
        setRetryAfter(data.retryAfter || 900);
        setMessage({ type: 'error', text: data.message || 'Too many attempts. Please try again later.' });
      } else if (data.success) {
        setIsVerified(true);
        setMessage({ type: 'success', text: 'Verification successful!' });
        setOtp('');
        setIsRateLimited(false);
        setRetryAfter(0);
        onVerified();
      } else {
        setMessage({ type: 'error', text: data.message || 'Verification failed' });
      }
    } catch (error) {
      console.error('Verify OTP failed:', error);
      setMessage({ type: 'error', text: 'Verification failed' });
    } finally {
      setIsVerifyingOtp(false);
      if (recaptchaRef.current) recaptchaRef.current.reset();
    }
  };

  if (isVerifying) {
    return (
      <div className={`${fullScreen ? 'min-h-screen' : 'py-8'} flex items-center justify-center ${fullScreen ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60' : ''} p-4 ${className}`}>
        <Card className="w-full max-w-md shadow-lg border border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center relative z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-6 mb-2">Verifying Status</h3>
            <p className="text-muted-foreground text-center">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerified) {
    return null;
  }

  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'py-8'} flex items-center justify-center ${fullScreen ? 'bg-gradient-to-br from-background via-background to-muted/20' : ''} p-4 ${className}`}>
      <Card className="w-full max-w-md shadow-2xl border-border/50 bg-card overflow-hidden">
        {/* Header Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
          <CardHeader className="text-center pb-6 pt-8 relative z-10">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/5">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-center mt-3 text-muted-foreground text-base max-w-[85%] mx-auto leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
        </div>

        <CardContent className="space-y-8 px-8 pb-8">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <Badge
              variant={isVerified ? 'default' : 'secondary'}
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${isVerified ? 'bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 border-green-500/20' : 'bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 border-red-500/20'
                }`}
            >
              {isVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>

          {!isVerified && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
                      setOtp(value);
                    }}
                    maxLength={12}
                    disabled={isRateLimited}
                    className="w-full h-14 pl-12 pr-4 text-center text-xl font-bold tracking-[0.2em] border-2 border-input rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 bg-background/50 hover:border-primary/50 disabled:opacity-50 placeholder:text-muted-foreground/30 placeholder:tracking-normal placeholder:font-normal"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-xs text-muted-foreground/50 font-medium font-mono">
                      {otp.length}/12
                    </span>
                  </div>
                </div>

                {isRateLimited && retryAfter > 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>Too many attempts. Try again in {Math.ceil(retryAfter / 60)} minutes.</span>
                  </div>
                )}

                {message && (
                  <div
                    className={`text-sm p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success'
                      ? 'text-green-700 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50'
                      : 'text-red-700 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'
                      }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    )}
                    <span className="font-medium">{message.text}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  onClick={handleSendClick}
                  disabled={isSendingOtp || isRateLimited || otpCooldown > 0}
                  variant="outline"
                  className="h-12 border-2 hover:bg-primary/5 hover:border-primary/50 text-base transition-all duration-200 relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isSendingOtp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : otpCooldown > 0 ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4 transition-transform group-hover:scale-110" />
                    )}
                    {isSendingOtp ? 'Sending...' : otpCooldown > 0 ? `${otpCooldown}s` : 'Send Code'}
                  </span>
                </Button>

                <Button
                  onClick={handleVerifyClick}
                  disabled={isVerifyingOtp || isRateLimited || otp.length < 6}
                  className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-base font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
                >
                  {isVerifyingOtp ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ReCAPTCHA Modal */}
      <Dialog open={showCaptchaModal} onOpenChange={(open) => {
        if (!open) {
          setShowCaptchaModal(false);
          setPendingAction(null);
          // recaptchaRef.current?.reset(); // Optional: reset on close? No, might want to keep if solved but just closed?
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Security Check</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Please complete the security check to proceed.
            </p>
            <div className="transform scale-90 sm:scale-100">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || ''}
                onChange={onCaptchaChange}
                onExpired={onCaptchaExpired}
                onError={onCaptchaError}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
