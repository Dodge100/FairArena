import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@clerk/clerk-react';
import { CheckCircle, Clock, Loader2, Mail, Shield, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

interface OTPVerificationProps {
  onVerified: () => void;
  title?: string;
  description?: string;
}

export function OTPVerification({
  onVerified,
  title = 'Account Verification',
  description = 'Verify your account to access sensitive settings. Verification expires in 10 minutes.',
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

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

  const onCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const onCaptchaExpired = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  const onCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setMessage('CAPTCHA verification failed. Please try again.');
  }, []);
  const getRecaptchaToken = async () => {
    if (!captchaToken) {
      setMessage('Please complete the CAPTCHA');
      return '';
    }
    return captchaToken;
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
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else if (res.status === 400 && data?.message?.toLowerCase().includes('captcha')) {
        setMessage(data.message || 'Captcha verification failed. Please retry.');
        // Reset CAPTCHA on captcha failure
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        setMessage(data.message || 'Failed to send OTP');
        // Reset CAPTCHA on send failure
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error('Send OTP failed:', error);
      setMessage('Failed to send OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      setMessage('Please enter at least 6 characters for the OTP');
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
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else if (res.status === 400 && data?.message?.toLowerCase().includes('captcha')) {
        setMessage(data.message || 'Captcha verification failed. Please retry.');
        // Reset CAPTCHA on captcha failure
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        setMessage(data.message || 'Verification failed');
        // Reset CAPTCHA on verification failure
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
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
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Verifying Account</h3>
            <p className="text-muted-foreground text-center">Please wait while we check your verification status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerified) {
    return null;
  }

  return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-6 pt-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {title}
          </CardTitle>
          <CardDescription className="text-center mt-2 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/30 rounded-xl border">
            <span className="text-sm font-medium">Verification Status:</span>
            <Badge variant={isVerified ? 'default' : 'destructive'} className="w-fit font-medium">
              {isVerified ? 'Verified' : 'Not Verified'}
            </Badge>
          </div>

          {!isVerified && (
            <>
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium flex items-center justify-center space-x-2 text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>Enter OTP Code</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 6-12 alphanumeric characters"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
                      setOtp(value);
                    }}
                    maxLength={12}
                    disabled={isRateLimited}
                    className="w-full h-14 text-center text-xl font-bold border-2 border-input rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-200 bg-background hover:border-primary/50 disabled:opacity-50 tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {otp.length}/12 characters (minimum 6)
                  </p>
                </div>
                {/* Visible reCAPTCHA v2 checkbox */}
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || ''}
                    onChange={onCaptchaChange}
                    onExpired={onCaptchaExpired}
                    onError={onCaptchaError}
                  />
                </div>
                {isRateLimited && retryAfter > 0 && (
                  <div className="text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5" />
                      <span>Too many attempts. Try again in {Math.ceil(retryAfter / 60)} minutes.</span>
                    </div>
                  </div>
                )}
                {otpCooldown > 0 && !isRateLimited && (
                  <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5" />
                      <span>Next OTP request available in {otpCooldown} seconds</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={sendOtp}
                  disabled={
                    isSendingOtp ||
                    isRateLimited ||
                    otpCooldown > 0 ||
                    !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ||
                    !captchaToken
                  }
                  variant="outline"
                  className="flex-1 h-12 font-semibold border-2 hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                >
                  {isSendingOtp ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : isRateLimited ? (
                    <XCircle className="h-5 w-5 mr-2" />
                  ) : otpCooldown > 0 ? (
                    <Clock className="h-5 w-5 mr-2" />
                  ) : (
                    <Mail className="h-5 w-5 mr-2" />
                  )}
                  {isSendingOtp
                    ? 'Sending...'
                    : isRateLimited
                      ? 'Rate Limited'
                      : otpCooldown > 0
                        ? `Wait ${otpCooldown}s`
                        : !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY
                          ? 'Captcha not configured'
                          : !captchaToken
                            ? 'Complete CAPTCHA'
                            : 'Send OTP'}
                </Button>
                <Button
                  onClick={verifyOtp}
                  disabled={
                    isVerifyingOtp ||
                    isRateLimited ||
                    !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ||
                    !captchaToken ||
                    otp.length < 6
                  }
                  className="flex-1 h-12 font-semibold bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-lg"
                >
                  {isVerifyingOtp ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Shield className="h-5 w-5 mr-2" />
                  )}
                  {isVerifyingOtp
                    ? 'Verifying...'
                    : !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY
                      ? 'Captcha not configured'
                      : !captchaToken
                        ? 'Complete CAPTCHA'
                        : otp.length < 6
                          ? 'Enter 6+ chars'
                          : 'Verify'}
                </Button>
              </div>
            </>
          )}

          {message && (
            <div
              className={`text-sm p-4 rounded-xl border-2 ${
                message.includes('success')
                  ? 'text-green-700 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                  : 'text-red-700 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                {message.includes('success') ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
