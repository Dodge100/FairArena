import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

type MfaMethod = 'authenticator' | 'backup' | 'email' | 'notification' | 'push';
type AuthStep = 'credentials' | 'mfa';

interface MfaSessionState {
  active: boolean;
  expiresAt: number | null;
  attemptsRemaining: number;
}

export default function Signin() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Authentication step
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');

  // MFA state
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('authenticator');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSession, setMfaSession] = useState<MfaSessionState>({
    active: false,
    expiresAt: null,
    attemptsRemaining: 5,
  });
  const [showMfaHelp, setShowMfaHelp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Helper to get cookie value
  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  // Helper to delete cookie
  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  // Get redirect path from location state or cookie (OAuth flow uses cookie)
  const getRedirectPath = useCallback(() => {
    // First check location state (from ProtectedLayout redirect)
    if (location.state?.from?.pathname) {
      return location.state.from.pathname;
    }
    // Then check cookie (from OAuth MFA redirect)
    const cookieRedirect = getCookie('mfa_redirect');
    if (cookieRedirect) {
      deleteCookie('mfa_redirect'); // Clean up after reading
      return cookieRedirect;
    }
    return '/dashboard';
  }, [location.state]);

  // Calculate time remaining for MFA session
  const getTimeRemaining = useCallback(() => {
    if (!mfaSession.expiresAt) return 0;
    const remaining = Math.max(0, Math.floor((mfaSession.expiresAt - Date.now()) / 1000));
    return remaining;
  }, [mfaSession.expiresAt]);

  // Clean up URL parameters on mount (in case of old redirects or errors)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('mfaRequired') || params.has('tempToken') || params.has('error')) {
      // Clean up URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Check for existing MFA session on mount
  useEffect(() => {
    const checkExistingMfaSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/mfa/check-session`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.hasMfaSession) {
            setAuthStep('mfa');
            setMfaSession({
              active: true,
              expiresAt: Date.now() + (result.data?.ttl || 300) * 1000,
              attemptsRemaining: result.data?.attemptsRemaining || 5,
            });
          }
        }
      } catch (err) {
        console.error('Failed to check MFA session:', err);
      }
    };

    if (!authLoading && !isAuthenticated) {
      checkExistingMfaSession();
    }
  }, [apiUrl, authLoading, isAuthenticated]);

  // MFA session expiry timer
  useEffect(() => {
    if (authStep !== 'mfa' || !mfaSession.active || !mfaSession.expiresAt) return;

    const checkExpiry = () => {
      const remaining = getTimeRemaining();
      if (remaining <= 0) {
        toast.error('Verification session expired. Please sign in again.');
        handleResetToCredentials();
      } else if (remaining === 60) {
        toast.warning('Your verification session will expire in 1 minute');
      }
    };

    const timer = setInterval(checkExpiry, 1000);
    return () => clearInterval(timer);
  }, [authStep, mfaSession, getTimeRemaining]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, getRedirectPath]);

  // Handle credential submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.mfaRequired) {
        // MFA is required - transition to MFA step
        setAuthStep('mfa');
        setMfaSession({
          active: true,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
          attemptsRemaining: 5,
        });
        toast.info('Two-factor authentication required', {
          description: 'Please enter the 6-digit code from your authenticator app',
        });
      } else {
        // Login successful without MFA
        toast.success('Welcome back!');
        const redirectPath = getRedirectPath();
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA verification
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isBackupCode = mfaMethod === 'backup';
      const isOtpMethod = mfaMethod === 'email' || mfaMethod === 'notification';

      let endpoint = `${apiUrl}/api/v1/auth/verify-mfa`;
      let body: Record<string, unknown> = {
        code: mfaCode.replace(/\s/g, ''),
        isBackupCode,
      };

      if (isOtpMethod) {
        endpoint = `${apiUrl}/api/v1/auth/mfa/verify-otp`;
        body = {
          code: mfaCode.replace(/\s/g, ''),
          method: mfaMethod,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Verification failed');
      }

      // Successful MFA verification
      toast.success('Welcome back!');

      // Full page reload to properly set auth state from cookies
      const redirectPath = getRedirectPath();
      window.location.href = redirectPath;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);

      // Check for session expiry
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('session')) {
        handleResetToCredentials();
        return;
      }

      // Update attempts remaining
      setMfaSession(prev => ({
        ...prev,
        attemptsRemaining: Math.max(0, prev.attemptsRemaining - 1),
      }));

      // Show help after failed attempts
      if (mfaSession.attemptsRemaining <= 3) {
        setShowMfaHelp(true);
      }

      toast.error(message);
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP for alternative MFA methods
  const handleSendOtp = async (method: 'email' | 'notification') => {
    setIsLoading(true);
    setError('');

    try {
      const endpoint = method === 'email'
        ? `${apiUrl}/api/v1/auth/mfa/send-email-otp`
        : `${apiUrl}/api/v1/auth/mfa/send-notification-otp`;

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to send verification code');
      }

      setMfaMethod(method);
      setOtpSent(true);
      setMfaCode('');
      toast.success(result.message || `Verification code sent to your ${method}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send code';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to credentials step
  const handleResetToCredentials = async () => {
    setIsLoading(true);

    try {
      await fetch(`${apiUrl}/api/v1/auth/mfa/invalidate`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to invalidate MFA session:', err);
    }

    setAuthStep('credentials');
    setMfaMethod('authenticator');
    setMfaCode('');
    setMfaSession({ active: false, expiresAt: null, attemptsRemaining: 5 });
    setShowMfaHelp(false);
    setOtpSent(false);
    setError('');
    setIsLoading(false);
  };

  // State for push approval
  const [pushRequestId, setPushRequestId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pending' | 'approved' | 'denied'>('idle');

  // Send push approval request
  const handleSendPushApproval = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/mfa/send-push-approval`, {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to send approval request');
      }

      setMfaMethod('push');
      setPushRequestId(result.data?.pushRequestId || null);
      setPushStatus('pending');
      toast.success('Approval request sent to your devices');

      // Start polling for approval status
      pollPushStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll push approval status
  const pollPushStatus = useCallback(async () => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/mfa/check-push-status`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (result.status === 'approved') {
          setPushStatus('approved');
          // Complete login
          toast.success('Login approved!');
          const redirectPath = getRedirectPath();
          window.location.href = redirectPath;
          return true; // Stop polling
        } else if (result.status === 'denied') {
          setPushStatus('denied');
          toast.error('Login was denied');
          return true; // Stop polling
        } else if (result.status === 'expired' || result.status === 'not_found') {
          setPushStatus('idle');
          toast.error('Approval request expired');
          return true; // Stop polling
        }
        return false; // Continue polling
      } catch (err) {
        console.error('Failed to check push status:', err);
        return false;
      }
    };

    // Poll every 2 seconds for up to 2 minutes
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
      attempts++;
      const shouldStop = await checkStatus();
      if (shouldStop || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts && pushStatus === 'pending') {
          setPushStatus('idle');
          toast.error('Approval request timed out');
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [apiUrl, getRedirectPath, pushStatus]);


  // Google OAuth login
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/google?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Google sign-in URL');
      }
    } catch (err) {
      console.error('Google login error:', err);
      toast.error('Failed to initiate Google sign-in');
      setIsLoading(false);
    }
  };

  // GitHub OAuth login
  const handleGithubLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/github?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get GitHub sign-in URL');
      }
    } catch (err) {
      console.error('GitHub login error:', err);
      toast.error('Failed to initiate GitHub sign-in');
      setIsLoading(false);
    }
  };

  // Format time remaining display
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render MFA verification form
  const renderMfaForm = () => {
    const isBackupCode = mfaMethod === 'backup';
    const isOtpMethod = mfaMethod === 'email' || mfaMethod === 'notification';
    const isPushMethod = mfaMethod === 'push';
    const timeRemaining = getTimeRemaining();
    // Backup codes are 10 alphanumeric chars (shown with dashes as XXXX-XXXX-XX)
    const codeLength = isBackupCode ? 10 : 6;

    return (
      <>
        {/* Header */}
        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          2-Step Verification
        </h1>

        <p className={`text-center max-w-md mb-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {mfaMethod === 'push'
            ? 'Approve this login request from one of your trusted devices'
            : isBackupCode
              ? 'Enter one of your 8-character backup codes'
              : isOtpMethod
                ? `Enter the 6-digit code sent to your ${mfaMethod}`
                : "Enter the 6-digit code from your authenticator app"}
        </p>

        {/* Session timer */}
        {timeRemaining > 0 && (
          <p className={`text-xs mb-4 ${timeRemaining <= 60 ? 'text-orange-500 font-medium animate-pulse' : isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
            Session expires in {formatTimeRemaining(timeRemaining)}
          </p>
        )}

        <div className="w-full max-w-sm px-4">
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Code input - hide for push method */}
            {!isPushMethod && (
              <div>
                <label
                  htmlFor="mfaCode"
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                >
                  {isBackupCode ? 'Backup Code' : 'Verification Code'}
                </label>
                <input
                  id="mfaCode"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isBackupCode) {
                      // Allow alphanumeric, strip dashes, max 10 chars
                      setMfaCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                    } else {
                      setMfaCode(val.replace(/\D/g, '').slice(0, 6));
                    }
                    setError('');
                  }}
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode={isBackupCode ? 'text' : 'numeric'}
                  required
                  placeholder={isBackupCode ? 'XXXX-XXXX-XX' : '123456'}
                  className={`
                    w-full px-4 py-4 rounded-xl border-2 transition-all font-mono text-center text-2xl tracking-[0.4em]
                    ${isDark
                      ? 'bg-neutral-800/50 text-neutral-100 border-neutral-700 focus:border-[#DDEF00] focus:bg-neutral-800'
                      : 'bg-neutral-50 text-neutral-900 border-neutral-200 focus:border-[#DDEF00] focus:bg-white'}
                    focus:outline-none focus:ring-4 focus:ring-[#DDEF00]/20
                    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
                  `}
                />
                {mfaSession.attemptsRemaining < 5 && (
                  <p className={`text-xs mt-2 ${mfaSession.attemptsRemaining <= 2 ? 'text-orange-500' : isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    {mfaSession.attemptsRemaining} attempt{mfaSession.attemptsRemaining !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            )}

            {/* Help section */}
            {showMfaHelp && !isBackupCode && !isOtpMethod && (
              <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                <p className="font-medium mb-1">Having trouble?</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Make sure your device's time is synced correctly</li>
                  <li>Wait for the next code if the current one is about to expire</li>
                  <li>Try using a backup code or email verification below</li>
                </ul>
              </div>
            )}

            {/* Submit button - hide for push method */}
            {!isPushMethod && (
              <button
                type="submit"
                disabled={isLoading || mfaCode.length !== codeLength}
                className="w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#DDEF00] shadow-sm hover:shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </span>
                ) : 'Verify'}
              </button>
            )}

            {/* Alternative methods section */}
            <div className="mt-6 space-y-4">
              {!showAlternatives ? (
                <button
                  type="button"
                  onClick={() => setShowAlternatives(true)}
                  className={`w-full text-sm font-medium hover:underline ${isDark ? 'text-[#DDEF00]' : 'text-neutral-900'}`}
                >
                  Try another way
                </button>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                      Choose a method
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAlternatives(false)}
                      className={`text-xs hover:underline ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                    >
                      Hide
                    </button>
                  </div>

                  {mfaMethod !== 'authenticator' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMfaMethod('authenticator');
                        setMfaCode('');
                        setError('');
                        setOtpSent(false);
                        setShowAlternatives(false);
                      }}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      Authenticator App
                    </button>
                  )}

                  {mfaMethod !== 'backup' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMfaMethod('backup');
                        setMfaCode('');
                        setError('');
                        setShowMfaHelp(false);
                        setOtpSent(false);
                        setShowAlternatives(false);
                      }}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      Backup Code
                    </button>
                  )}

                  {mfaMethod !== 'email' && !otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSendOtp('email');
                        setShowAlternatives(false);
                      }}
                      disabled={isLoading}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      Email Verification
                    </button>
                  )}

                  {mfaMethod !== 'notification' && !otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSendOtp('notification');
                        setShowAlternatives(false);
                      }}
                      disabled={isLoading}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      In-App Notification
                    </button>
                  )}

                  {mfaMethod !== 'push' && pushStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSendPushApproval();
                        setShowAlternatives(false);
                      }}
                      disabled={isLoading}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      Device Approval
                    </button>
                  )}

                  {pushStatus === 'pending' && (
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse">
                          <svg className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                            Waiting for approval...
                          </p>
                          <p className={`text-xs ${isDark ? 'text-blue-400/70' : 'text-blue-600'}`}>
                            Check your other logged-in devices
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Back to sign in */}
              <button
                type="button"
                onClick={handleResetToCredentials}
                disabled={isLoading}
                className={`w-full text-sm py-2 ${isDark ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-600 hover:text-neutral-800'} transition-colors`}
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        </div>
      </>
    );
  };

  // Render credentials form
  const renderCredentialsForm = () => (
    <>
      <img
        src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
        className="w-30 mb-2"
        alt="Fair Arena Logo"
      />
      <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
        Welcome Back
      </h1>
      <p className={`mb-4 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
        Sign in to your FairArena account
      </p>

      <div className="w-full max-w-sm px-4">
        {/* Google OAuth button - Moved to Top */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full mb-4 py-3 px-4 flex items-center justify-center gap-3 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* GitHub OAuth button */}
        <button
          type="button"
          onClick={handleGithubLogin}
          disabled={isLoading}
          className={`w-full mb-4 py-3 px-4 flex items-center justify-center gap-3 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-neutral-900 hover:bg-neutral-800 text-white'}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          Continue with GitHub
        </button>

        {/* Divider */}
        <div className="relative my-4">
          <div className={`absolute inset-0 flex items-center ${isDark ? 'opacity-30' : 'opacity-20'}`}>
            <div className={`w-full border-t ${isDark ? 'border-neutral-600' : 'border-neutral-300'}`} />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-4 ${isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-white text-neutral-500'}`}>
              or sign in with email
            </span>
          </div>
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
            />
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="password"
              className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
            />
          </div>

          {/* Forgot password link */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className={`text-sm ${isDark ? 'text-[#DDEF00] hover:text-[#f0ff33]' : 'text-neutral-600 hover:text-neutral-900'} transition-colors`}
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>

          {/* Sign up link */}
          <p className={`text-center text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Don't have an account?{' '}
            <Link
              to="/signup"
              state={location.state}
              className={`font-medium ${isDark ? 'text-[#DDEF00] hover:text-[#f0ff33]' : 'text-neutral-900 hover:underline'}`}
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </>
  );

  return (
    <div className={`fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
      <div className="w-full h-screen flex flex-col md:flex-row rounded-none overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.2)]">
        {/* Left side - Auth form */}
        <div className={`w-full md:w-1/2 flex flex-col py-6 items-center justify-start h-full overflow-y-auto overflow-x-hidden ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
          {/* Logo was moved inside forms to better handle MFA view vs Credentials view spacing */}
          {/* Render appropriate form based on auth step */}
          {authStep === 'mfa' ? renderMfaForm() : renderCredentialsForm()}
        </div>

        {/* Right side - Illustration */}
        <div className={`hidden md:flex w-1/2 items-center justify-center p-8 ${isDark ? 'bg-[#0f0f0f] border-l border-neutral-800' : 'bg-[#EEF0FF] border-l border-neutral-200'}`}>
          <div className="relative w-full max-w-md">
            <h2 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              Perfectly Judge Hackathon Teams and View Leaderboards
            </h2>
            <p className={`mb-6 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Sign in to access your dashboard and manage your competitions.
            </p>
            <img
              src="https://fairarena.blob.core.windows.net/fairarena/Dashboard Preview"
              alt="Dashboard Preview"
              className="rounded-xl shadow-2xl border"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
