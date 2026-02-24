/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { DeviceAuthModal } from '@/components/auth/DeviceAuthModal';
import { OAuthBanner } from '@/components/auth/OAuthBanner';
import { OAuthSocials } from '@/components/auth/OAuthSocials';
import { QRAuthDialog } from '@/components/auth/QRAuthDialog';
import { initiatePasskeyLogin, usePasskeySupport } from '@/components/PasskeyManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { publicApiFetch } from '@/lib/apiClient';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { Eye, EyeOff, LayoutDashboard, RefreshCw, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';
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

const LastUsedBadge = () => (
  <span className="absolute -top-3 right-2 bg-[#DDEF00] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm border border-black/10 animate-in zoom-in duration-200 z-20">
    Last Used
  </span>
);

export default function Signin() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
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

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  }>({
    emailMfaEnabled: false,
    notificationMfaEnabled: false,
    webauthnMfaAvailable: false,
    superSecureAccountEnabled: false,
  });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showDeviceAuth, setShowDeviceAuth] = useState(false);

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const passkeySupported = usePasskeySupport();

  // SSO State
  const [ssoState, setSsoState] = useState<{
    enabled: boolean;
    providerType?: string;
    loginUrl?: string;
    checking: boolean;
  }>({ enabled: false, checking: false });

  const checkSSO = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val || !val.includes('@')) return;

    setSsoState((p) => ({ ...p, checking: true }));
    try {
      const res = await publicApiFetch(
        `${apiUrl}/api/v1/auth/sso/check?email=${encodeURIComponent(val)}`,
      );
      const data = await res.json();
      if (data.ssoEnabled) {
        setSsoState({
          enabled: true,
          providerType: data.providerType,
          loginUrl: data.ssoUrl,
          checking: false,
        });
      } else {
        setSsoState({ enabled: false, checking: false });
      }
    } catch {
      setSsoState({ enabled: false, checking: false });
    }
  };

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

    // First check for OAuth request parameter (from OAuth consent flow)
    const params = new URLSearchParams(window.location.search);
    const oauthRequest = params.get('oauth_request') || sessionStorage.getItem('oauth_request_id');
    if (oauthRequest) {
      return `/oauth/consent?request_id=${oauthRequest}`;
    }

    // Then check location state (from ProtectedLayout redirect)
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
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}?${params.toString()}`,
      );
    }
  }, []);

  // Persist and restore OAuth request across redirects (signup, MFA, passkey, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlOAuthRequest = params.get('oauth_request');
    const storedOAuthRequest = sessionStorage.getItem('oauth_request_id');

    // If oauth_request is in URL, store it for persistence
    if (urlOAuthRequest) {
      sessionStorage.setItem('oauth_request_id', urlOAuthRequest);
    }
    // If oauth_request is in storage but not in URL, restore it to URL
    else if (storedOAuthRequest && !urlOAuthRequest) {
      params.set('oauth_request', storedOAuthRequest);
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}?${params.toString()}`,
      );
    }
  }, []);

  // Clean up flow from sessionStorage on successful login
  const clearAddAccountFlow = useCallback(() => {
    sessionStorage.removeItem('auth_flow');
  }, []);

  // Clean up OAuth request from sessionStorage
  const clearOAuthRequest = useCallback(() => {
    sessionStorage.removeItem('oauth_request_id');
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
        const response = await publicApiFetch(`${apiUrl}/api/v1/auth/check-mfa-session`, {
          method: 'GET',
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
                superSecureAccountEnabled:
                  result.data.mfaPreferences.superSecureAccountEnabled || false,
              });

              if (isNewDevice) {
                if (result.data.activeOtpMethod) {
                  setMfaMethod(result.data.activeOtpMethod);
                  setOtpSent(true);
                } else {
                  setMfaMethod(
                    result.data.mfaPreferences.emailMfaEnabled ? 'email' : 'notification',
                  );
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
    if (ssoState.enabled && ssoState.loginUrl) {
      window.location.href = ssoState.loginUrl;
      return;
    }
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
            const onlyWebAuthn =
              result.mfaPreferences.webauthnMfaAvailable &&
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
          clearOAuthRequest();
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

        const response = await publicApiFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Recaptcha-Token': token,
          },
          body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Verification failed');
        }

        toast.success('Welcome back!');
        clearAddAccountFlow();
        clearOAuthRequest();
        const redirectPath = getRedirectPath();
        window.location.href = redirectPath;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);

      if (authStep === 'mfa') {
        if (
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('session')
        ) {
          handleResetToCredentials();
          return;
        }

        setMfaSession((prev) => ({
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
  const handleSendOtp = useCallback(
    async (method: 'email' | 'notification') => {
      setIsLoading(true);
      setError('');

      try {
        const endpoint =
          method === 'email'
            ? `${apiUrl}/api/v1/auth/mfa/send-email-otp`
            : `${apiUrl}/api/v1/auth/mfa/send-notification-otp`;

        const response = await publicApiFetch(endpoint, {
          method: 'POST',
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
    },
    [apiUrl],
  );

  // Auto-send OTP for new device flow (only if email/notification is available)
  // Also auto-trigger WebAuthn if that's the only option
  useEffect(() => {
    if (authStep === 'new_device' && !isLoading) {
      // Check if only WebAuthn is available
      const onlyWebAuthn =
        mfaPreferences.webauthnMfaAvailable &&
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
      await publicApiFetch(`${apiUrl}/api/v1/auth/mfa/invalidate`, {
        method: 'POST',
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
        clearOAuthRequest();
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
      const optionsRes = await publicApiFetch(
        `${apiUrl}/api/v1/mfa/webauthn/authenticate/options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const optionsData = await optionsRes.json();

      if (!optionsData.success) {
        throw new Error(optionsData.message || 'Failed to initialize security key request');
      }

      // Step 2: Authenticate with browser
      const credential = await startAuthentication({
        optionsJSON: optionsData.data,
      });

      // Step 3: Verify with server
      const verifyRes = await publicApiFetch(`${apiUrl}/api/v1/mfa/webauthn/authenticate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      clearOAuthRequest();
      const redirectPath = getRedirectPath();
      window.location.href = redirectPath;
    } catch (error) {
      console.error('WebAuthn MFA error:', error);
      const message = error instanceof Error ? error.message : 'Authentication failed';

      if (
        message.includes('cancelled') ||
        message.includes('canceled') ||
        message.includes('AbortError')
      ) {
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
        <div className="text-center w-full px-4 flex flex-col justify-center h-full">
          <h1 className="text-3xl font-bold mb-2 text-white">Security Check</h1>
          <p className="mb-8 text-neutral-400">
            Super Secure Account enabled. Only security keys are allowed.
          </p>

          <div className="flex justify-center mb-8">
            <div className="p-6 rounded-full bg-neutral-800 border border-neutral-700">
              <svg
                className="w-12 h-12 text-[#DDEF00]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWebAuthnMfaVerification}
            disabled={passkeyLoading || isLoading}
            className="w-full py-3.5 px-4 mb-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passkeyLoading || isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </>
            ) : (
              'Use Security Key'
            )}
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
      <div className="w-full max-w-sm px-4 flex flex-col justify-center h-full">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2 text-white">2-Step Verification</h1>

          <p className="text-center max-w-md mb-2 text-neutral-400">
            {isBackupCode
              ? 'Enter one of your 8-character backup codes'
              : isOtpMethod
                ? `Enter the 6-digit code sent to your ${mfaMethod}`
                : 'Enter the 6-digit code from your authenticator app'}
          </p>

          {/* Session timer */}
          {timeRemaining > 0 && (
            <p
              className={`text-xs ${timeRemaining <= 60 ? 'text-orange-500 font-medium animate-pulse' : 'text-neutral-500'}`}
            >
              Session expires in {formatTimeRemaining(timeRemaining)}
            </p>
          )}
        </div>

        <div className="w-full">
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Code input */}
            <div>
              <label
                htmlFor="mfaCode"
                className="block text-sm font-medium mb-3 text-neutral-300 text-center uppercase tracking-wide"
              >
                {isBackupCode ? 'Backup Code' : 'Enter Verification Code'}
              </label>
              <input
                id="mfaCode"
                type="text"
                value={mfaCode}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isBackupCode) {
                    // Allow alphanumeric, strip dashes, max 10 chars
                    setMfaCode(
                      val
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 10),
                    );
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
                className="w-full px-4 py-5 rounded-2xl border-2 transition-all font-mono text-center text-3xl tracking-[0.5em] bg-white/5 text-white border-neutral-800 focus:border-[#DDEF00] focus:bg-neutral-900 focus:outline-none focus:ring-4 focus:ring-[#DDEF00]/10 placeholder:text-neutral-700"
              />
              {mfaSession.attemptsRemaining < 5 && (
                <p
                  className={`text-xs mt-3 text-center ${mfaSession.attemptsRemaining <= 2 ? 'text-orange-500' : 'text-neutral-500'}`}
                >
                  {mfaSession.attemptsRemaining} attempt
                  {mfaSession.attemptsRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>

            {/* Help section */}
            {showMfaHelp && !isBackupCode && !isOtpMethod && (
              <div className="p-3 rounded-lg text-sm bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <p className="font-medium mb-1">Having trouble?</p>
                <ul className="list-disc list-inside space-y-1 text-xs opacity-80">
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
              className="w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </button>

            {/* Alternative methods section */}
            <div className="mt-6 space-y-4">
              {!showAlternatives ? (
                <button
                  type="button"
                  onClick={() => setShowAlternatives(true)}
                  className="w-full text-sm font-medium hover:underline text-[#DDEF00] transition-colors"
                >
                  Try another way
                </button>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Choose a method
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAlternatives(false)}
                      className="text-xs hover:underline text-neutral-400 hover:text-white"
                    >
                      Hide
                    </button>
                  </div>

                  {mfaMethod !== 'authenticator' &&
                    authStep !== 'new_device' &&
                    !mfaPreferences.superSecureAccountEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setMfaMethod('authenticator');
                          setMfaCode('');
                          setError('');
                          setOtpSent(false);
                          setShowAlternatives(false);
                        }}
                        className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white"
                      >
                        <div className="p-1.5 rounded-lg bg-neutral-700">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                        Authenticator App
                      </button>
                    )}

                  {mfaMethod !== 'backup' &&
                    authStep !== 'new_device' &&
                    !mfaPreferences.superSecureAccountEnabled && (
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
                        className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white"
                      >
                        <div className="p-1.5 rounded-lg bg-neutral-700">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
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
                      className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white"
                    >
                      <div className="p-1.5 rounded-lg bg-neutral-700">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
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
                      className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white"
                    >
                      <div className="p-1.5 rounded-lg bg-neutral-700">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
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
                      className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white"
                    >
                      <div className="p-1.5 rounded-lg bg-neutral-700">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                          />
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
                className="w-full text-sm py-2 text-neutral-500 hover:text-neutral-400 transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render message when WebAuthn is required but not supported
  const renderWebAuthnUnsupported = () => (
    <div className="w-full max-w-sm px-4 flex flex-col justify-center h-full text-center">
      <img
        src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
        className="h-10 mx-auto mb-6"
        alt="FairArena Logo"
      />

      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-3 text-white">Device Not Supported</h1>

      <p className="mb-8 text-neutral-400">
        This account requires a security key for verification, but your current device or browser
        does not support WebAuthn.
      </p>

      <div className="p-4 rounded-xl text-left text-sm mb-8 bg-neutral-900 border border-neutral-800">
        <p className="font-medium mb-1 text-neutral-200">Recommended Action:</p>
        <p className="text-neutral-400">
          Please sign in using a supported OAuth provider (Google, GitHub, etc.) or use a different
          device.
        </p>
      </div>

      <button
        onClick={handleResetToCredentials}
        className="w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)]"
      >
        Back to Check In
      </button>
    </div>
  );

  // Render credentials form
  const renderCredentialsForm = () => (
    <div className="w-full max-w-sm px-4 flex flex-col justify-center h-full">
      <div className="mb-8 text-center">
        <img
          src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
          className="h-10 mx-auto mb-6"
          alt="FairArena Logo"
        />
        <h1 className="text-3xl font-bold mb-2 text-white">Welcome back</h1>
        <p className="text-neutral-400">Sign in to your FairArena account</p>
      </div>

      {/* Primary OAuth - Google */}
      <OAuthSocials getRedirectPath={getRedirectPath} lastUsedMethod={lastUsedMethod} />

      {/* Passkey - Prominent full-width button */}
      {passkeySupported && (
        <button
          type="button"
          onClick={handlePasskeyLogin}
          disabled={isLoading || passkeyLoading}
          className="relative w-full mb-3 py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 bg-white/5 hover:bg-white/10 border border-white/10 text-white"
        >
          {lastUsedMethod === 'passkey' && <LastUsedBadge />}
          {passkeyLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Authenticating...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 text-[#DDEF00]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" />
                <path d="M10 11V8a4 4 0 118 0v3" />
                <path d="M4 21a8 8 0 0116 0" />
              </svg>
              Sign in with Passkey
            </>
          )}
        </button>
      )}

      {/* Additional Options Container */}
      {(showQRDialog || showDeviceAuth) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setShowQRDialog(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM5 8h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1zm10 0h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V9a1 1 0 011-1zM5 8v4m4 0V8m6 0v4m4 0V8m-6 11v4m-2 0h2"
              />
            </svg>
            QR Code
          </button>
          <button
            type="button"
            onClick={() => setShowDeviceAuth(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors"
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
                d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11V8a4 4 0 118 0v3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0116 0" />
            </svg>
            Device Code
          </button>
        </div>
      )}

      {!showQRDialog && !showDeviceAuth && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setShowQRDialog(true)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Sign in with QR
          </button>
          <span className="text-neutral-700">|</span>
          <button
            onClick={() => setShowDeviceAuth(true)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Device Code
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center opacity-20">
          <div className="w-full border-t border-neutral-200"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="px-4 bg-[#0a0a0a] text-neutral-500">Or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-start gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Email input */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              const val = e.target.value;
              setEmail(val);
              setError('');
              if (ssoState.enabled && !val.includes('@')) {
                setSsoState({ enabled: false, checking: false });
              }
            }}
            onBlur={checkSSO}
            required
            autoComplete="email"
            placeholder="name@company.com"
            className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
          />
        </div>

        {/* Password input */}
        {!ssoState.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-[#DDEF00] hover:text-[#f0ff33] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required={!ssoState.enabled}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-10 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleCredentialsSubmit}
          disabled={isLoading || !email || (!ssoState.enabled && !password)}
          className="relative w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)]"
        >
          {lastUsedMethod === 'email' && <LastUsedBadge />}
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {ssoState.enabled ? 'Signing in with SSO...' : 'Signing in...'}
            </span>
          ) : ssoState.enabled ? (
            'Continue with SSO'
          ) : (
            'Sign In'
          )}
        </button>

        {/* Sign up link */}
        <div className="pt-4 text-center">
          <p className="text-sm text-neutral-500">
            {import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true'
              ? "Don't have an account? "
              : 'Want to join? '}
            <Link
              to={import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true' ? '/signup' : '/waitlist'}
              state={location.state}
              className="font-medium text-[#DDEF00] hover:text-[#efff5e] transition-colors"
            >
              {import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true' ? 'Sign up' : 'Join Waitlist'}
            </Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-600">
            By signing in, you agree to our{' '}
            <Link
              to="/terms-and-conditions"
              className="hover:text-white transition-colors underline decoration-neutral-700"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy-policy"
              className="hover:text-white transition-colors underline decoration-neutral-700"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <OAuthBanner />
      <div className="fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <div className="w-full h-screen flex flex-col md:flex-row overflow-hidden">
          {/* LEFT SIDE — AUTH FORM */}
          <div className="w-full md:w-1/2 flex flex-col items-center justify-center h-full relative z-10 bg-[#0a0a0a]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="w-full h-full overflow-y-auto no-scrollbar py-8 px-6 flex flex-col items-center"
            >
              <div className="w-full mt-auto mb-auto">
                {/* Render appropriate form based on auth step */}
                {isCheckingSession ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
                  </div>
                ) : authStep === 'webauthn_unsupported' ? (
                  renderWebAuthnUnsupported()
                ) : authStep === 'mfa' || authStep === 'new_device' ? (
                  renderMfaForm()
                ) : (
                  renderCredentialsForm()
                )}
              </div>
            </motion.div>
          </div>

          {/* RIGHT SIDE — ILLUSTRATION */}
          <AuthIllustration
            title="Secure access to FairArena"
            subtitle="Manage your projects, track progress, and collaborate with your team in one centralized platform."
            icon={<Shield className="w-10 h-10 text-black font-bold" />}
            features={[
              { icon: Shield, text: 'Secure Access', desc: 'MFA Protected' },
              { icon: LayoutDashboard, text: 'Smart Dashboard', desc: 'Project overview' },
              { icon: RefreshCw, text: 'Live Updates', desc: 'Real-time sync' },
              { icon: Zap, text: 'Quick Login', desc: 'Passkey support' },
            ]}
          />
        </div>

        {/* Captcha Modal */}
        <Dialog open={showCaptcha} onOpenChange={setShowCaptcha}>
          <DialogContent
            className={`sm:max-w-md ${isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white'}`}
          >
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

        <QRAuthDialog open={showQRDialog} onOpenChange={setShowQRDialog} />
        <DeviceAuthModal open={showDeviceAuth} onOpenChange={setShowDeviceAuth} />
      </div>
    </>
  );
}
