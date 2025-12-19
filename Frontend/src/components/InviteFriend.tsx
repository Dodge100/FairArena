import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@clerk/clerk-react';
import { Mail, Shield, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { toast } from 'sonner';

function InviteFriend() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { isSignedIn, getToken } = useAuth();

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

  const handleCaptchaSubmit = async () => {
    if (!captchaToken) {
      toast.error('Please complete the CAPTCHA verification.');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/platform/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await getToken()) || ''}`,
          'X-Recaptcha-Token': captchaToken,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Something went wrong. Please try again later.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowCaptchaModal(false);
    setCaptchaToken(null);
    recaptchaRef.current?.reset();
  };

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
        Invite Friends
      </h3>

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
            placeholder="friend@example.com"
            className={`
              flex-1 px-3 py-2 text-sm rounded-lg outline-none transition
              ${isDark
                ? 'bg-neutral-800 text-white placeholder-neutral-500 border border-neutral-700 focus:border-[#DDFF00]'
                : 'bg-white text-black placeholder-neutral-500 border border-neutral-300 focus:border-[#556000]'
              }
            `}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition
              flex items-center gap-2 whitespace-nowrap
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isDark
                ? 'bg-[#DDFF00] text-black hover:bg-[#DDFF00]/80'
                : 'bg-[#556000] text-white hover:bg-[#8aa300]'
              }
            `}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Invite
              </>
            )}
          </button>
        </form>
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
            <DialogTitle className={`flex items-center gap-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
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
                  ${isDark
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
                disabled={isLoading || !captchaToken || !import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all
                  flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDark
                    ? 'bg-[#DDFF00] text-black hover:bg-[#DDFF00]/80'
                    : 'bg-[#556000] text-white hover:bg-[#8aa300]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Sending...
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
                    Send Invite
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
