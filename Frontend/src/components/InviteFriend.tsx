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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from '@/hooks/useTheme';
import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, Shield, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiRequest } from '../lib/apiClient';
import { useAuthState } from '../lib/auth';

function InviteFriend() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { isSignedIn } = useAuthState();

  const onCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const onCaptchaExpired = useCallback(() => {
    setCaptchaToken(null);
    toast.error('CAPTCHA expired. Please try again.');
  }, []);

  const onCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    toast.error('CAPTCHA verification failed. Please try again.');
  }, []);

  const inviteMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/platform/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Recaptcha-Token': token,
          },
          body: JSON.stringify({ email }),
        },
      ),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'Invitation sent successfully!');
        setEmail('');
        setShowCaptchaModal(false);
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        toast.error(data.message || 'Failed to send invitation. Please try again.');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    },
    onError: (error) => {
      console.error('Invite error:', error);
      toast.error('Something went wrong. Please try again later.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    },
  });

  if (!isSignedIn) {
    return null;
  }

  const handleEmailInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Open captcha modal instead of submitting directly
    setShowCaptchaModal(true);
  };

  const isLoading = inviteMutation.isPending;

  const handleCaptchaSubmit = () => {
    if (!captchaToken) {
      toast.error('Please complete the CAPTCHA verification.');
      return;
    }
    inviteMutation.mutate(captchaToken);
  };

  const handleCloseModal = () => {
    setShowCaptchaModal(false);
    setCaptchaToken(null);
    recaptchaRef.current?.reset();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
          {t('footer.invite.title')}
        </h3>
        <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {t('footer.invite.desc')}
        </p>
      </div>

      {/* Email Invite */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailInvite();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('footer.invite.placeholder')}
            className={`
              flex-1 px-3 py-2.5 text-sm rounded-lg outline-none transition
              ${
                isDark
                  ? 'bg-neutral-800 text-white placeholder-neutral-500 border border-neutral-700 focus:border-[#DDFF00]'
                  : 'bg-white text-black placeholder-neutral-500 border border-neutral-300 focus:border-[#556000]'
              }
            `}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`
              px-4 py-2.5 text-sm font-medium rounded-lg transition
              flex items-center gap-2 whitespace-nowrap justify-center
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isDark
                  ? 'bg-[#DDFF00] text-black hover:bg-[#DDFF00]/80'
                  : 'bg-[#556000] text-white hover:bg-[#8aa300]'
              }
            `}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t('footer.invite.loading')}
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                {t('footer.invite.button')}
              </>
            )}
          </button>
        </form>

        {/* Trust Signals */}
        <div className="flex items-center gap-4 text-xs">
          <div
            className={`flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}
          >
            <Lock className="w-3 h-3" />
            <span>{t('footer.invite.trust')}</span>
          </div>
        </div>
      </div>

      {/* CAPTCHA Modal */}
      <Dialog open={showCaptchaModal} onOpenChange={setShowCaptchaModal}>
        <DialogContent
          className={`
            sm:max-w-md
            ${isDark ? 'bg-[rgba(15,15,15,0.95)] border-neutral-800' : 'bg-white border-neutral-200'}
          `}
        >
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
            >
              <Shield className="w-5 h-5 text-[#DDFF00]" />
              Verify You're Human
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
              Complete the CAPTCHA verification to send the invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* reCAPTCHA */}
            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || ''}
                onChange={onCaptchaChange}
                onExpired={onCaptchaExpired}
                onError={onCaptchaError}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isLoading}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-medium transition-all
                  ${
                    isDark
                      ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <X className="w-4 h-4 inline mr-2" />
                Cancel
              </button>
              <button
                onClick={handleCaptchaSubmit}
                disabled={
                  isLoading || !captchaToken || !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY
                }
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all
                  flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isDark
                      ? 'bg-[#DDFF00] text-black hover:bg-[#DDFF00]/80'
                      : 'bg-[#556000] text-white hover:bg-[#8aa300]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {t('footer.invite.loading')}
                  </>
                ) : !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY ? (
                  'CAPTCHA not configured'
                ) : !captchaToken ? (
                  <>
                    <Shield className="w-4 h-4" />
                    Complete CAPTCHA
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    {t('footer.invite.button')}
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InviteFriend;
