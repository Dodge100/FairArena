import { initiatePasskeyLogin, usePasskeySupport } from '@/components/PasskeyManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { useCallback, useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

type MfaMethod = 'authenticator' | 'backup' | 'email' | 'notification';
type AuthStep = 'credentials' | 'mfa' | 'new_device' | 'webauthn_unsupported';

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
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);

  useEffect(() => {
    const savedMethod = localStorage.getItem('lastUsedAuthMethod');
    if (savedMethod) {
      setLastUsedMethod(savedMethod);
    }
  }, []);

  const saveLastUsedMethod = (method: string) => {
    localStorage.setItem('lastUsedAuthMethod', method);
    setLastUsedMethod(method);
  };

  const LastUsedBadge = () => (
    <span className="absolute -top-2.5 -right-2 bg-[#DDEF00] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm border border-black/10 animate-in zoom-in duration-200">
      Last Used
    </span>
  );

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
    webauthnMfaAvailable?: boolean;
    superSecureAccountEnabled?: boolean;
  }>({ emailMfaEnabled: false, notificationMfaEnabled: false, webauthnMfaAvailable: false, superSecureAccountEnabled: false });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

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

  // Build OAuth URL with flow parameter preserved
  const getOAuthUrl = useCallback((provider: string) => {
    const redirectPath = getRedirectPath();
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow') || sessionStorage.getItem('auth_flow');

    // Build the final redirect with flow parameter if needed
    let finalRedirect = redirectPath;
    if (flow === 'add_account') {
      // Include flow in the state that will be passed through OAuth
      finalRedirect = finalRedirect.includes('?')
        ? `${finalRedirect}&flow=add_account`
        : `${finalRedirect}?flow=add_account`;
    }

    return `${apiUrl}/api/v1/auth/${provider}?redirect=${encodeURIComponent(finalRedirect)}`;
  }, [getRedirectPath, apiUrl]);

  // Calculate time remaining for MFA session
  const getTimeRemaining = useCallback(() => {
    if (!mfaSession.expiresAt) return 0;
    const remaining = Math.max(0, Math.floor((mfaSession.expiresAt - Date.now()) / 1000));
    return remaining;
  }, [mfaSession.expiresAt]);

  // Persist and restore add_account flow across redirects (OAuth, MFA)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFlow = params.get('flow');
    const storedFlow = sessionStorage.getItem('auth_flow');

    // If flow is in URL, store it for persistence across redirects
    if (urlFlow === 'add_account') {
      sessionStorage.setItem('auth_flow', 'add_account');
    }
    // If flow is in storage but not in URL, restore it to URL
    else if (storedFlow === 'add_account' && !urlFlow) {
      params.set('flow', 'add_account');
      window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  // Clean up flow from sessionStorage on successful login
  const clearAddAccountFlow = useCallback(() => {
    sessionStorage.removeItem('auth_flow');
  }, []);

  // Clean up URL parameters on mount (in case of old redirects or errors)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Check for specific errors
    const errorParam = params.get('error');
    if (errorParam === 'signup_disabled') {
      toast.error('Signups are currently disabled. Please join our waitlist.');
    } else if (errorParam === 'max_accounts_reached') {
      toast.error('Maximum number of accounts reached. Please log out from an account first.', {
        duration: 5000,
      });
    } else if (errorParam) {
      // Decode potential URL-encoded error messages
      toast.error(decodeURIComponent(errorParam).replace(/_/g, ' '));
    }

    if (params.has('mfaRequired') || params.has('tempToken') || params.has('error')) {
      // Clean up URL without reloading, but preserve flow parameter
      const flow = params.get('flow');
      const newUrl = flow ? `${window.location.pathname}?flow=${flow}` : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Check for existing MFA session on mount
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      setIsCheckingSession(false);
      return;
    }

    const checkExistingMfaSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/check-mfa-session`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.hasMfaSession) {
            const isNewDevice = result.data?.type === 'new_device_pending';
            setAuthStep(isNewDevice ? 'new_device' : 'mfa');

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
                webauthnMfaAvailable: result.data.mfaPreferences.webauthnMfaAvailable || false,
                superSecureAccountEnabled: result.data.mfaPreferences.superSecureAccountEnabled || false,
              });

              if (isNewDevice) {
                if (result.data.activeOtpMethod) {
                  setMfaMethod(result.data.activeOtpMethod);
                  setOtpSent(true);
                } else {
                  setMfaMethod(result.data.mfaPreferences.emailMfaEnabled ? 'email' : 'notification');
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to check MFA session:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingMfaSession();
  }, [apiUrl, authLoading, isAuthenticated]);

  // Auto-trigger WebAuthn for Super Secure Accounts
  useEffect(() => {
    const shouldAutoTrigger =
      (authStep === 'mfa' || authStep === 'new_device') &&
      mfaPreferences.superSecureAccountEnabled &&
      !isLoading &&
      !passkeyLoading;

    if (shouldAutoTrigger) {
      // Small timeout to allow UI to render first
      const timer = setTimeout(() => {
        handleWebAuthnMfaVerification();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authStep, mfaPreferences.superSecureAccountEnabled, isLoading, passkeyLoading]);

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

  // Redirect if already authenticated (skip if adding another account)
  useEffect(() => {
    // Check for add_account flow - don't redirect in this case
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow');
    if (flow === 'add_account') {
      return; // Allow user to add another account without redirecting
    }

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
        saveLastUsedMethod('email');
        const result = await login(email, password, token);

        if (result.mfaRequired) {
          setAuthStep('mfa');
          if (result.mfaPreferences) {
            setMfaPreferences({
              emailMfaEnabled: result.mfaPreferences.emailMfaEnabled,
              notificationMfaEnabled: result.mfaPreferences.notificationMfaEnabled,
              webauthnMfaAvailable: result.mfaPreferences.webauthnMfaAvailable,
              superSecureAccountEnabled: result.mfaPreferences.superSecureAccountEnabled,
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
        } else if (result.newDeviceVerificationRequired) {
          // New device detected - require verification
          setAuthStep('new_device');
          if (result.mfaPreferences) {
            setMfaPreferences({
              emailMfaEnabled: result.mfaPreferences.emailMfaEnabled,
              notificationMfaEnabled: result.mfaPreferences.notificationMfaEnabled,
              webauthnMfaAvailable: result.mfaPreferences.webauthnMfaAvailable,
              superSecureAccountEnabled: result.mfaPreferences.superSecureAccountEnabled,
            });

            // Check if only WebAuthn is available (no email/notification fallback)
            const onlyWebAuthn = result.mfaPreferences.webauthnMfaAvailable &&
              !result.mfaPreferences.emailMfaEnabled &&
              !result.mfaPreferences.notificationMfaEnabled;

            if (onlyWebAuthn) {
              // Don't set any OTP method - WebAuthn will be triggered automatically
              setMfaSession({
                active: true,
                expiresAt: Date.now() + 5 * 60 * 1000,
                attemptsRemaining: 5,
              });
              toast.info('Security key required', {
                description: 'Use your security key to verify this device',
              });
              return; // Early return - WebAuthn will be triggered by useEffect
            }

            // Auto-select email if available, otherwise notification
            setMfaMethod(result.mfaPreferences.emailMfaEnabled ? 'email' : 'notification');
          } else {
            // Default to email if no preferences available
            setMfaMethod('email');
          }
          setMfaSession({
            active: true,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attemptsRemaining: 5,
          });
          toast.info('New device detected', {
            description: 'Please verify your identity via email or notification code',
          });
        } else {
          toast.success('Welcome back!');
          clearAddAccountFlow();
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
        clearAddAccountFlow();
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
  const handleSendOtp = useCallback(async (method: 'email' | 'notification') => {
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
  }, [apiUrl]);

  // Auto-send OTP for new device flow (only if email/notification is available)
  // Also auto-trigger WebAuthn if that's the only option
  useEffect(() => {
    if (authStep === 'new_device' && !isLoading) {
      // Check if only WebAuthn is available
      const onlyWebAuthn = mfaPreferences.webauthnMfaAvailable &&
        !mfaPreferences.emailMfaEnabled &&
        !mfaPreferences.notificationMfaEnabled;

      if (onlyWebAuthn) {
        if (!browserSupportsWebAuthn()) {
          setAuthStep('webauthn_unsupported');
          return;
        }

        // Auto-trigger WebAuthn authentication
        const timer = setTimeout(() => {
          handleWebAuthnMfaVerification();
        }, 100);
        return () => clearTimeout(timer);
      }

      // Otherwise, send OTP if not already sent
      if (!otpSent && (mfaMethod === 'email' || mfaMethod === 'notification')) {
        const timer = setTimeout(() => {
          handleSendOtp(mfaMethod);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [authStep, otpSent, mfaMethod, mfaPreferences, isLoading, handleSendOtp]);

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
      saveLastUsedMethod('google');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('google'));
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
      saveLastUsedMethod('github');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('github'));
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
      saveLastUsedMethod('microsoft');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('microsoft'));
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
      saveLastUsedMethod('discord');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('discord'));
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
      saveLastUsedMethod('huggingface');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('huggingface'));
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
      saveLastUsedMethod('gitlab');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('gitlab'));
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
      saveLastUsedMethod('slack');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('slack'));
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

  // Notion OAuth login
  const handleNotionLogin = async () => {
    try {
      saveLastUsedMethod('notion');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('notion'));
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Notion sign-in URL');
      }
    } catch (err) {
      console.error('Notion login error:', err);
      toast.error('Failed to initiate Notion sign-in');
      setIsLoading(false);
    }
  };

  // X (Twitter) OAuth login
  const handleXLogin = async () => {
    try {
      saveLastUsedMethod('x');
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/x?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get X sign-in URL');
      }
    } catch (err) {
      console.error('X login error:', err);
      toast.error('Failed to initiate X sign-in');
      setIsLoading(false);
    }
  };

  // Zoho OAuth login
  const handleZohoLogin = async () => {
    try {
      saveLastUsedMethod('zoho');
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/zoho?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Zoho sign-in URL');
      }
    } catch (err) {
      console.error('Zoho login error:', err);
      toast.error('Failed to initiate Zoho sign-in');
      setIsLoading(false);
    }
  };

  // Linear OAuth login
  const handleLinearLogin = async () => {
    try {
      saveLastUsedMethod('linear');
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/linear?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Linear sign-in URL');
      }
    } catch (err) {
      console.error('Linear login error:', err);
      toast.error('Failed to initiate Linear sign-in');
      setIsLoading(false);
    }
  };

  // Dropbox OAuth login
  const handleDropboxLogin = async () => {
    try {
      saveLastUsedMethod('dropbox');
      setIsLoading(true);
      const redirectPath = getRedirectPath();
      const response = await fetch(
        `${apiUrl}/api/v1/auth/dropbox?redirect=${encodeURIComponent(redirectPath)}`
      );
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get Dropbox sign-in URL');
      }
    } catch (err) {
      console.error('Dropbox login error:', err);
      toast.error('Failed to initiate Dropbox sign-in');
      setIsLoading(false);
    }
  };

  // LinkedIn OAuth login (OpenID Connect)
  const handleLinkedInLogin = async () => {
    try {
      saveLastUsedMethod('linkedin');
      setIsLoading(true);
      const response = await fetch(getOAuthUrl('linkedin'));
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Failed to get LinkedIn sign-in URL');
      }
    } catch (err) {
      console.error('LinkedIn login error:', err);
      toast.error('Failed to initiate LinkedIn sign-in');
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
      saveLastUsedMethod('passkey');
      const result = await initiatePasskeyLogin(apiUrl);

      if (result.success && result.user && result.accessToken) {
        toast.success('Welcome back!');
        // Full page reload to properly set auth state from cookies
        clearAddAccountFlow();
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

  // WebAuthn MFA Verification
  const handleWebAuthnMfaVerification = async () => {
    try {
      if (!browserSupportsWebAuthn()) {
        toast.error('WebAuthn is not supported in this browser');
        return;
      }

      setIsLoading(true);

      // Step 1: Get authentication options
      const optionsRes = await fetch(`${apiUrl}/api/v1/mfa/webauthn/authenticate/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const optionsData = await optionsRes.json();

      if (!optionsData.success) {
        throw new Error(optionsData.message || 'Failed to initialize security key request');
      }

      // Step 2: Authenticate with browser
      const credential = await startAuthentication({
        optionsJSON: optionsData.data,
      });

      // Step 3: Verify with server
      const verifyRes = await fetch(`${apiUrl}/api/v1/mfa/webauthn/authenticate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: credential }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        throw new Error(verifyData.message || 'Security key verification failed');
      }

      // Success
      toast.success('Signed in successfully');

      // Clear flow and redirect (full reload to pick up session)
      clearAddAccountFlow();
      const redirectPath = getRedirectPath();
      window.location.href = redirectPath;

    } catch (error) {
      console.error('WebAuthn MFA error:', error);
      const message = error instanceof Error ? error.message : 'Authentication failed';

      if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
        // User cancelled, just stop loading
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render MFA verification form
  const renderMfaForm = () => {
    // Super Secure Account Enforcement UI
    if (mfaPreferences.superSecureAccountEnabled) {
      return (
        <div className="text-center w-full px-4">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Security Check
          </h1>
          <p className={`mb-8 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Super Secure Account enabled. Only security keys are allowed.
          </p>

          <div className="flex justify-center mb-8">
            <div className={`p-6 rounded-full ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
              <svg className={`w-12 h-12 ${isDark ? 'text-[#DDEF00]' : 'text-neutral-900'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWebAuthnMfaVerification}
            disabled={passkeyLoading || isLoading}
            className={`w-full py-3.5 px-4 mb-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-xl font-semibold transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {passkeyLoading || isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : 'Use Security Key'}
          </button>
        </div>
      );
    }

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

                  {mfaMethod !== 'authenticator' && authStep !== 'new_device' && !mfaPreferences.superSecureAccountEnabled && (
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

                  {mfaMethod !== 'backup' && authStep !== 'new_device' && !mfaPreferences.superSecureAccountEnabled && (
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

                  {/* Security Key Option */}
                  {mfaPreferences.webauthnMfaAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        handleWebAuthnMfaVerification();
                        setShowAlternatives(false);
                      }}
                      disabled={isLoading}
                      className={`w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${isDark ? 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-200 hover:text-white' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-black'}`}
                    >
                      <div className={`p-1.5 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      Use Security Key
                    </button>
                  )}

                  {mfaPreferences.emailMfaEnabled && mfaMethod !== 'email' && (
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

                  {mfaPreferences.notificationMfaEnabled && mfaMethod !== 'notification' && (
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

  // Render message when WebAuthn is required but not supported
  const renderWebAuthnUnsupported = () => (
    <>
      <img
        src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
        className="w-30 mb-8"
        alt="FairArena Logo"
      />
      <div className="w-full max-w-sm px-4 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          Device Not Supported
        </h1>

        <p className={`mb-8 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          This account requires a security key for verification, but your current device or browser does not support WebAuthn.
        </p>

        <div className={`p-4 rounded-xl text-left text-sm mb-8 ${isDark ? 'bg-neutral-800/50 border border-neutral-700' : 'bg-neutral-100 border border-neutral-200'}`}>
          <p className={`font-medium mb-1 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
            Recommended Action:
          </p>
          <p className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
            Please sign in using a supported OAuth provider (Google, GitHub, etc.) or use a different device.
          </p>
        </div>

        <button
          onClick={handleResetToCredentials}
          className={`w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-xl font-semibold transition-all active:scale-[0.98] shadow-sm hover:shadow-md`}
        >
          Back to Sign In
        </button>
      </div>
    </>
  );

  // Render credentials form
  const renderCredentialsForm = () => (
    <>
      <img
        src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
        className="w-30 mb-2"
        alt="FairArena Logo"
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
          className="relative w-full mb-3 py-2.5 px-4 flex items-center justify-center gap-2 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {lastUsedMethod === 'google' && <LastUsedBadge />}
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
            className={`relative w-full mb-3 py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${isDark ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'}`}
          >
            {lastUsedMethod === 'passkey' && <LastUsedBadge />}
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
            className={`relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'}`}
          >
            {lastUsedMethod === 'github' && <LastUsedBadge />}
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
            className={`relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 border border-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200'}`}
          >
            {lastUsedMethod === 'microsoft' && <LastUsedBadge />}
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
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#5865F2] hover:bg-[#4752C4] text-white"
          >
            {lastUsedMethod === 'discord' && <LastUsedBadge />}
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
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#FC6D26] hover:bg-[#E24329] text-white"
          >
            {lastUsedMethod === 'gitlab' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="m23.6 9.593-.033-.086L20.3.98a.851.851 0 0 0-.336-.405.874.874 0 0 0-.992.062.858.858 0 0 0-.285.473l-2.212 6.775H7.534L5.322 1.11a.857.857 0 0 0-.285-.474.868.868 0 0 0-.992-.061.852.852 0 0 0-.336.405L.433 9.507l-.033.086a6.066 6.066 0 0 0 2.012 7.01l.011.008.027.02 4.973 3.727 2.462 1.863 1.5 1.133a1.007 1.007 0 0 0 1.22 0l1.5-1.133 2.462-1.863 4.999-3.745.014-.01a6.068 6.068 0 0 0 2.012-7.01z" />
            </svg>
          </button>
        </div>

        {/* Secondary OAuth Row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* X (Twitter) */}
          <button
            type="button"
            onClick={handleXLogin}
            disabled={isLoading}
            title="X (Twitter)"
            className={`relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'}`}
          >
            {lastUsedMethod === 'x' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>

          {/* Notion */}
          <button
            type="button"
            onClick={handleNotionLogin}
            disabled={isLoading}
            title="Notion"
            className={`relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-white hover:bg-neutral-200 text-black' : 'bg-black hover:bg-neutral-800 text-white'}`}
          >
            {lastUsedMethod === 'notion' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
            </svg>
          </button>
          {/* Hugging Face */}
          <button
            type="button"
            onClick={handleHuggingFaceLogin}
            disabled={isLoading}
            title="Hugging Face"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#FFD21E] hover:bg-[#E5BD1B] text-black"
          >
            {lastUsedMethod === 'huggingface' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378 0 1.112.178 2.181.503 3.185.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284.278.173.48.408.71.694.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542.01.026.653 1.552 1.657 2.54.616.605 1.01 1.223 1.082 1.912.055.537-.096 1.059-.38 1.572.637.121 1.294.187 1.967.187.657 0 1.298-.063 1.921-.178-.287-.517-.44-1.041-.384-1.581.07-.69.465-1.307 1.081-1.913 1.004-.987 1.647-2.513 1.657-2.539.021-.074.083-.285.233-.542.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952.23-.286.432-.52.71-.694.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378M8.327 6.583a1.5 1.5 0 0 1 .713.174 1.487 1.487 0 0 1 .617 2.013c-.183.343-.762-.214-1.102-.094-.38.134-.532.914-.917.71a1.487 1.487 0 0 1 .69-2.803m7.486 0a1.487 1.487 0 0 1 .689 2.803c-.385.204-.536-.576-.916-.71-.34-.12-.92.437-1.103.094a1.487 1.487 0 0 1 .617-2.013 1.5 1.5 0 0 1 .713-.174m-10.68 1.55a.96.96 0 1 1 0 1.921.96.96 0 0 1 0-1.92m13.838 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92M8.489 11.458c.588.01 1.965 1.157 3.572 1.164 1.607-.007 2.984-1.155 3.572-1.164.196-.003.305.12.305.454 0 .886-.424 2.328-1.563 3.202-.22-.756-1.396-1.366-1.63-1.32q-.011.001-.02.006l-.044.026-.01.008-.03.024q-.018.017-.035.036l-.032.04a1 1 0 0 0-.058.09l-.014.025q-.049.088-.11.19a1 1 0 0 1-.083.116 1.2 1.2 0 0 1-.173.18q-.035.029-.075.058a1.3 1.3 0 0 1-.251-.243 1 1 0 0 1-.076-.107c-.124-.193-.177-.363-.337-.444-.034-.016-.104-.008-.2.022q-.094.03-.216.087-.06.028-.125.063l-.13.074q-.067.04-.136.086a3 3 0 0 0-.135.096 3 3 0 0 0-.26.219 2 2 0 0 0-.12.121 2 2 0 0 0-.106.128l-.002.002a2 2 0 0 0-.09.132l-.001.001a1.2 1.2 0 0 0-.105.212q-.013.036-.024.073c-1.139-.875-1.563-2.317-1.563-3.203 0-.334.109-.457.305-.454m.836 10.354c.824-1.19.766-2.082-.365-3.194-1.13-1.112-1.789-2.738-1.789-2.738s-.246-.945-.806-.858-.97 1.499.202 2.362c1.173.864-.233 1.45-.685.64-.45-.812-1.683-2.896-2.322-3.295s-1.089-.175-.938.647 2.822 2.813 2.562 3.244-1.176-.506-1.176-.506-2.866-2.567-3.49-1.898.473 1.23 2.037 2.16c1.564.932 1.686 1.178 1.464 1.53s-3.675-2.511-4-1.297c-.323 1.214 3.524 1.567 3.287 2.405-.238.839-2.71-1.587-3.216-.642-.506.946 3.49 2.056 3.522 2.064 1.29.33 4.568 1.028 5.713-.624m5.349 0c-.824-1.19-.766-2.082.365-3.194 1.13-1.112-1.789-2.738 1.789-2.738s.246-.945.806-.858.97 1.499-.202 2.362c-1.173.864.233 1.45.685.64.451-.812 1.683-2.896 2.322-3.295s1.089-.175.938.647-2.822 2.813-2.562 3.244 1.176-.506 1.176-.506 2.866-2.567 3.49-1.898-.473 1.23-2.037 2.16c-1.564.932-1.686 1.178-1.464 1.53s3.675-2.511 4-1.297c.323 1.214-3.524 1.567-3.287 2.405.238.839 2.71-1.587 3.216-.642.506.946-3.49 2.056-3.522 2.064-1.29.33-4.568 1.028-5.713-.624" />
            </svg>
          </button>

          {/* Slack */}
          <button
            type="button"
            onClick={handleSlackLogin}
            disabled={isLoading}
            title="Slack"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#4A154B] hover:bg-[#3a1039] text-white"
          >
            {lastUsedMethod === 'slack' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.272 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.835 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.835 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.835 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.835zm0 1.272a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.835a2.528 2.528 0 0 1 2.522-2.521h6.313zm10.123 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.835a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.835zm-1.271 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.313zm-2.522 10.123a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.272a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" />
            </svg>
          </button>
        </div>

        {/* Third OAuth Row - Additional Providers */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* Zoho */}
          <button
            type="button"
            onClick={handleZohoLogin}
            disabled={isLoading}
            title="Zoho"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#C8262A] hover:bg-[#A81E21] text-white"
          >
            {lastUsedMethod === 'zoho' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.66 6.897a1.299 1.299 0 0 0-1.205.765l-.642 1.44-.062-.385A1.291 1.291 0 0 0 5.27 7.648l-4.185.678A1.291 1.291 0 0 0 .016 9.807l.678 4.18a1.293 1.293 0 0 0 1.27 1.087c.074 0 .143-.01.216-.017l4.18-.678c.436-.07.784-.351.96-.723l2.933 1.307a1.304 1.304 0 0 0 .988.026c.321-.12.575-.365.716-.678l.28-.629.038.276a1.297 1.297 0 0 0 1.455 1.103l3.712-.501a1.29 1.29 0 0 0 1.03.514h4.236c.713 0 1.29-.58 1.291-1.291V9.545c0-.712-.58-1.291-1.291-1.291h-4.236c-.079 0-.155.008-.23.022a1.309 1.309 0 0 0-.275-.288c-.275-.21-.614-.3-.958-.253l-4.197.571c-.155.021-.3.07-.432.14L9.159 7.01a1.27 1.27 0 0 0-.499-.113zm-.025.705c.077 0 .159.013.24.052l2.971 1.324c-.128.238-.18.508-.142.782l.357 2.596h.002l-.745 1.672a.59.59 0 0 1-.777.296l-3.107-1.385-.004-.041-.41-2.526L8.1 7.95a.589.589 0 0 1 .536-.348zm-3.159.733c.125 0 .245.039.343.112.13.09.21.227.237.382l.234 1.446-.56 1.259a1.27 1.27 0 0 0-.026.987c.12.322.364.575.678.717l.295.131a.585.585 0 0 1-.428.314l-4.185.678a.59.59 0 0 1-.674-.485l-.678-4.18a.588.588 0 0 1 .485-.674l4.185-.678c.03-.004.064-.01.094-.01zm11.705.09a.59.59 0 0 1 .415.173 1.287 1.287 0 0 0-.416.947v4.237c0 .033.003.065.005.097l-3.55.482a.586.586 0 0 1-.66-.502l-.191-1.403.899-2.017a1.29 1.29 0 0 0-.333-1.5l3.754-.51c.026-.004.051-.004.077-.004zm1.3.532h4.227c.326 0 .588.266.588.588v4.237a.589.589 0 0 1-.588.588h-4.237a.564.564 0 0 1-.12-.013c.47-.246.758-.765.684-1.318zm-5.988.309.254.113c.296.133.43.48.296.777l-.432.97-.207-1.465a.58.58 0 0 1 .09-.395zm5.39.538.453 3.325a.583.583 0 0 1-.453.65zM6.496 11.545l.17 1.052a.588.588 0 0 1-.293-.776zm3.985 4.344a.588.588 0 0 0-.612.603c0 .358.244.61.601.61a.582.582 0 0 0 .607-.608c0-.35-.242-.605-.596-.605zm5.545 0a.588.588 0 0 0-.612.603c0 .358.245.61.602.61a.582.582 0 0 0 .606-.608c0-.35-.24-.605-.596-.605zm-8.537.018a.047.047 0 0 0-.048.047v.085c0 .026.021.047.048.047h.52l-.623.9a.052.052 0 0 0-.009.027v.027c0 .026.021.047.048.047h.815a.047.047 0 0 0 .047-.047v-.085a.047.047 0 0 0-.047-.047h-.55l.606-.9a.05.05 0 0 0 .008-.026v-.028a.047.047 0 0 0-.047-.047zm5.303 0a.047.047 0 0 0-.047.047v1.086c0 .026.02.047.047.047h.135a.047.047 0 0 0 .047-.047v-.454h.545v.454c0 .026.02.047.047.047h.134a.047.047 0 0 0 .047-.047v-1.086a.047.047 0 0 0-.047-.047h-.134a.047.047 0 0 0-.047.047v.453h-.545v-.453a.047.047 0 0 0-.047-.047zm-2.324.164c.25 0 .372.194.372.425 0 .219-.109.425-.358.426-.242 0-.375-.197-.375-.419 0-.235.108-.432.36-.432zm5.545 0c.25 0 .372.194.372.425 0 .219-.108.425-.358.426-.242 0-.374-.197-.374-.419 0-.235.108-.432.36-.432z" />
            </svg>
          </button>

          {/* Linear */}
          <button
            type="button"
            onClick={handleLinearLogin}
            disabled={isLoading}
            title="Linear"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#5E6AD2] hover:bg-[#4B55B8] text-white"
          >
            {lastUsedMethod === 'linear' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.77 14.45a9.456 9.456 0 0 0 6.78 6.78l-6.78-6.78zm-.705-2.14l9.63 9.628a9.458 9.458 0 0 0 2.074-.492L2.557 10.236a9.458 9.458 0 0 0-.492 2.074zm.491-4.073L14.31 19.99a9.502 9.502 0 0 0 1.654-.995L3.55 6.583A9.502 9.502 0 0 0 2.556 8.237zm2.325-3.293l13.175 13.175a9.5 9.5 0 0 0 1.168-1.336L5.213 3.772a9.5 9.5 0 0 0-1.336 1.168zm2.698-2.15l12.131 12.132a9.5 9.5 0 0 0 .712-1.648L6.227 2.082a9.5 9.5 0 0 0-1.648.712zM9.55 2.065l12.385 12.385a9.458 9.458 0 0 0-.492-2.074L11.69 2.557a9.458 9.458 0 0 0-2.14-.492zm4.45.155a9.456 9.456 0 0 0-2.22.544l7.006 7.006a9.456 9.456 0 0 0 .544-2.22c-.084-.84-.34-1.694-.656-2.408a4.61 4.61 0 0 0-1.192-1.537 4.614 4.614 0 0 0-1.537-1.192c-.714-.316-1.568-.572-2.408-.656l.463.463z" />
            </svg>
          </button>

          {/* Dropbox */}
          <button
            type="button"
            onClick={handleDropboxLogin}
            disabled={isLoading}
            title="Dropbox"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#0061FF] hover:bg-[#004FD1] text-white"
          >
            {lastUsedMethod === 'dropbox' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 2L0 6.09l6 4.08L12 6.09 6 2zm12 0l-6 4.09 6 4.08 6-4.08L18 2zM0 14.18l6 4.08 6-4.08-6-4.08-6 4.08zm18-4.08l-6 4.08 6 4.08 6-4.08-6-4.08zM6 19.91l6 4.09 6-4.09-6-4.08-6 4.08z" />
            </svg>
          </button>

          {/* LinkedIn */}
          <button
            type="button"
            onClick={handleLinkedInLogin}
            disabled={isLoading}
            title="LinkedIn"
            className="relative p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 bg-[#0A66C2] hover:bg-[#004182] text-white"
          >
            {lastUsedMethod === 'linkedin' && <LastUsedBadge />}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
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
            className="relative w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {lastUsedMethod === 'email' && <LastUsedBadge />}
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
          {isCheckingSession ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
            </div>
          ) : (authStep === 'webauthn_unsupported' ? renderWebAuthnUnsupported() : authStep === 'mfa' || authStep === 'new_device' ? renderMfaForm() : renderCredentialsForm())}
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
