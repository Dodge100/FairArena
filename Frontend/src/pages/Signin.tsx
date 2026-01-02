import { initiatePasskeyLogin, usePasskeySupport } from '@/components/PasskeyManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCallback, useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

type MfaMethod = 'authenticator' | 'backup' | 'email' | 'notification';
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
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [mfaPreferences, setMfaPreferences] = useState<{
    emailMfaEnabled: boolean;
    notificationMfaEnabled: boolean;
  }>({ emailMfaEnabled: false, notificationMfaEnabled: false });
  const [showCaptcha, setShowCaptcha] = useState(false);

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const passkeySupported = usePasskeySupport();

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
    let path = '/dashboard';

    // First check location state (from ProtectedLayout redirect)
    if (location.state?.from?.pathname) {
      path = location.state.from.pathname;
    }
    // Then check cookie (from OAuth MFA redirect)
    else {
      const cookieRedirect = getCookie('mfa_redirect');
      if (cookieRedirect) {
        deleteCookie('mfa_redirect'); // Clean up after reading
        path = cookieRedirect;
      }
    }

    // Ensure path is decoded to avoid double-encoding issues
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
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

    // Check for specific errors
    const errorParam = params.get('error');
    if (errorParam === 'signup_disabled') {
      toast.error('Signups are currently disabled. Please join our waitlist.');
    } else if (errorParam) {
      // Decode potential URL-encoded error messages
      toast.error(decodeURIComponent(errorParam).replace(/_/g, ' '));
    }

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
            // Also fetch MFA preferences
            if (result.data?.mfaPreferences) {
              setMfaPreferences({
                emailMfaEnabled: result.data.mfaPreferences.emailMfaEnabled || false,
                notificationMfaEnabled: result.data.mfaPreferences.notificationMfaEnabled || false,
              });
            }
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

  // Trigger Captcha on submit
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowCaptcha(true);
  };

  // Perform action after Captcha
  const handleCaptchaVerify = async (token: string | null) => {
    if (!token) return;

    setShowCaptcha(false);
    setIsLoading(true);

    try {
      if (authStep === 'credentials') {
        // Login logic
        const result = await login(email, password, token);

        if (result.mfaRequired) {
          setAuthStep('mfa');
          if (result.mfaPreferences) {
            setMfaPreferences({
              emailMfaEnabled: result.mfaPreferences.emailMfaEnabled,
              notificationMfaEnabled: result.mfaPreferences.notificationMfaEnabled
            });
          }
          setMfaSession({
            active: true,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attemptsRemaining: 5,
          });
          toast.info('Two-factor authentication required', {
            description: 'Please enter the 6-digit code from your authenticator app',
          });
        } else {
          toast.success('Welcome back!');
          const redirectPath = getRedirectPath();
          navigate(redirectPath, { replace: true });
        }
      } else {
        // MFA logic
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
          headers: {
            'Content-Type': 'application/json',
            'X-Recaptcha-Token': token
          },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Verification failed');
        }

        toast.success('Welcome back!');
        const redirectPath = getRedirectPath();
        window.location.href = redirectPath;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);

      if (authStep === 'mfa') {
        if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('session')) {
          handleResetToCredentials();
          return;
        }

        setMfaSession(prev => ({
          ...prev,
          attemptsRemaining: Math.max(0, prev.attemptsRemaining - 1),
        }));

        if (mfaSession.attemptsRemaining <= 3) {
          setShowMfaHelp(true);
        }
        setMfaCode('');
      }

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Captcha on MFA submit
  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowCaptcha(true);
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

  // Microsoft OAuth login
  const handleMicrosoftLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/microsoft?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Microsoft sign-in URL');
      }
    } catch (err) {
      console.error('Microsoft login error:', err);
      toast.error('Failed to initiate Microsoft sign-in');
      setIsLoading(false);
    }
  };

  // Discord OAuth login
  const handleDiscordLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/discord?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Discord sign-in URL');
      }
    } catch (err) {
      console.error('Discord login error:', err);
      toast.error('Failed to initiate Discord sign-in');
      setIsLoading(false);
    }
  };

  // Hugging Face OAuth login
  const handleHuggingFaceLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/huggingface?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Hugging Face sign-in URL');
      }
    } catch (err) {
      console.error('Hugging Face login error:', err);
      toast.error('Failed to initiate Hugging Face sign-in');
      setIsLoading(false);
    }
  };

  // GitLab OAuth login
  const handleGitLabLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/gitlab?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get GitLab sign-in URL');
      }
    } catch (err) {
      console.error('GitLab login error:', err);
      toast.error('Failed to initiate GitLab sign-in');
      setIsLoading(false);
    }
  };

  // Slack OAuth login
  const handleSlackLogin = async () => {
    try {
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/slack?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Slack sign-in URL');
      }
    } catch (err) {
      console.error('Slack login error:', err);
      toast.error('Failed to initiate Slack sign-in');
      setIsLoading(false);
    }
  };

  // Passkey login
  const handlePasskeyLogin = async () => {
    if (!passkeySupported) {
      toast.error('Passkeys are not supported in this browser');
      return;
    }

    setPasskeyLoading(true);
    setError('');

    try {
      const result = await initiatePasskeyLogin(apiUrl);

      if (result.success && result.user && result.accessToken) {
        toast.success('Welcome back!');
        // Full page reload to properly set auth state from cookies
        const redirectPath = getRedirectPath();
        window.location.href = redirectPath;
      } else if (result.error === 'cancelled') {
        // User cancelled - do nothing
      } else {
        setError(result.error || 'Passkey authentication failed');
        toast.error(result.error || 'Passkey authentication failed');
      }
    } catch (err) {
      console.error('Passkey login error:', err);
      const message = err instanceof Error ? err.message : 'Passkey authentication failed';
      setError(message);
      toast.error(message);
    } finally {
      setPasskeyLoading(false);
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
          {isBackupCode
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

            {/* Code input */}
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

            {/* Submit button */}
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

                  {mfaPreferences.emailMfaEnabled && mfaMethod !== 'email' && !otpSent && (
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

                  {mfaPreferences.notificationMfaEnabled && mfaMethod !== 'notification' && !otpSent && (
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
        {/* Primary OAuth - Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full mb-3 py-2.5 px-4 flex items-center justify-center gap-2 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Passkey - Prominent full-width button */}
        {passkeySupported && (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={isLoading || passkeyLoading}
            className={`w-full mb-3 py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${isDark ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'}`}
          >
            {passkeyLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Authenticating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" />
                  <path d="M10 11V8a4 4 0 118 0v3" />
                  <path d="M4 21a8 8 0 0116 0" />
                </svg>
                Sign in with Passkey
              </>
            )}
          </button>
        )}

        {/* Compact OAuth Icon Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* GitHub */}
          <button
            type="button"
            onClick={handleGithubLogin}
            disabled={isLoading}
            title="GitHub"
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </button>

          {/* Microsoft */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
            title="Microsoft"
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          </button>

          {/* Discord */}
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={isLoading}
            title="Discord"
            className="p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#5865F2] hover:bg-[#4752C4] text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </button>

          {/* GitLab */}
          <button
            type="button"
            onClick={handleGitLabLogin}
            disabled={isLoading}
            title="GitLab"
            className="p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#FC6D26] hover:bg-[#E24329] text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="m23.6 9.593-.033-.086L20.3.98a.851.851 0 0 0-.336-.405.874.874 0 0 0-.992.062.858.858 0 0 0-.285.473l-2.212 6.775H7.534L5.322 1.11a.857.857 0 0 0-.285-.474.868.868 0 0 0-.992-.061.852.852 0 0 0-.336.405L.433 9.507l-.033.086a6.066 6.066 0 0 0 2.012 7.01l.011.008.027.02 4.973 3.727 2.462 1.863 1.5 1.133a1.007 1.007 0 0 0 1.22 0l1.5-1.133 2.462-1.863 4.999-3.745.014-.01a6.068 6.068 0 0 0 2.012-7.01z" />
            </svg>
          </button>
        </div>

        {/* Secondary OAuth Row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Hugging Face */}
          <button
            type="button"
            onClick={handleHuggingFaceLogin}
            disabled={isLoading}
            title="Hugging Face"
            className="p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#FFD21E] hover:bg-[#E5BD1B] text-black"
          >
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="currentColor">
              <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm-3.5 19.5c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5zm7 0c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5z" />
            </svg>
          </button>

          {/* Slack */}
          <button
            type="button"
            onClick={handleSlackLogin}
            disabled={isLoading}
            title="Slack"
            className="p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#4A154B] hover:bg-[#3a1039] text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.272 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.835 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.835 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.835 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.835zm0 1.272a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.835a2.528 2.528 0 0 1 2.522-2.521h6.313zm10.123 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.835a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.835zm-1.271 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.313zm-2.522 10.123a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.272a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" />
            </svg>
          </button>
        </div>

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
            {import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true' ? "Don't have an account? " : "Want to join? "}
            <Link
              to={import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true' ? "/signup" : "/waitlist"}
              state={location.state}
              className={`font-medium ${isDark ? 'text-[#DDEF00] hover:text-[#f0ff33]' : 'text-neutral-900 hover:underline'}`}
            >
              {import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true' ? "Sign up" : "Join Waitlist"}
            </Link>
          </p>
          <p className={`text-center text-xs mt-4 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
            By signing in, you agree to our{' '}
            <Link to="/terms-and-conditions" className="underline hover:text-[#DDEF00] transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" className="underline hover:text-[#DDEF00] transition-colors">
              Privacy Policy
            </Link>.
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

      {/* Captcha Modal */}
      <Dialog open={showCaptcha} onOpenChange={setShowCaptcha}>
        <DialogContent className={`sm:max-w-md ${isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle>Security Verification</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            <ReCAPTCHA
              sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
              theme={isDark ? 'dark' : 'light'}
              onChange={handleCaptchaVerify}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
