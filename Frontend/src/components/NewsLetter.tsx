import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/useTheme';
import { Shield, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { toast } from 'sonner';

function Newsletter() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

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

  const handleSubscribe = async () => {
    if (isLoading) return;

    if (!email.trim()) {
      toast.error('Please enter your email.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
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
      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${apiUrl}/api/v1/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Recaptcha-Token': captchaToken,
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Newsletter subscription request received!');
        setEmail('');
        setShowCaptchaModal(false);
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        toast.error(data.message || 'Failed to subscribe. Please try again.');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubscribe();
    }
  };

  return (
    <div
      className={`
        mb-20 px-4 sm:px-6 py-12 sm:py-14
        rounded-3xl
        max-w-3xl md:max-w-4xl lg:max-w-5xl
        mx-auto
        transition
      `}
    >
      {/* Subtitle */}
      <p
        className={`
          mt-6 sm:mt-10 text-center font-semibold
          text-[28px] sm:text-4xl md:text-5xl leading-snug
          ${isDark ? 'text-neutral-100' : 'text-neutral-800'}
        `}
      >
        Stay Updated With <span className="text-neutral-500">FairArena</span>
      </p>

      {/* Description */}
      <p
        className={`
          text-center mt-3 max-w-md sm:max-w-xl mx-auto
          text-xs sm:text-sm md:text-base
          ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
        `}
      >
        Subscribe to our newsletter and get updates about new features, upcoming hackathon tools, AI
        scoring upgrades, and more.
      </p>

      {/* Input + Button */}
      <div
        className={`
          flex flex-col sm:flex-row items-center
          gap-4 mt-8 w-full
          px-2 sm:px-0
        `}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          type="email"
          placeholder="Enter your email"
          disabled={isLoading}
          className={`
            w-full sm:flex-1
            px-5 py-3 rounded-full text-sm md:text-base outline-none
            transition-opacity
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${isDark
              ? 'bg-neutral-800 text-white placeholder-neutral-500 border border-neutral-700'
              : 'bg-white text-black placeholder-neutral-500 border border-neutral-300'
            }
          `}
        />

        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="
            w-full sm:w-auto
            px-8 py-3 text-sm md:text-base text-black font-semibold
            rounded-full bg-[#ddef00]
            hover:bg-[#ddef00]/80 transition
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {isLoading ? 'Subscribing...' : 'Subscribe'}
        </button>
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
              <Shield className="w-5 h-5 text-[#ddef00]" />
              Verify You're Human
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
              Complete the CAPTCHA verification to subscribe to our newsletter.
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
                className="
                  flex-1 px-4 py-2.5 rounded-lg font-semibold
                  bg-[#ddef00] text-black
                  hover:bg-[#ddef00]/80 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Subscribing...
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
                    <Shield className="w-4 h-4" />
                    Subscribe
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

export default Newsletter;
