import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';
import { Spotlight } from './ui/Spotlight';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface WaitlistResponse {
  success: boolean;
  message: string;
  data?: {
    position?: number;
    status?: string;
    hasAccount?: boolean;
    email?: string;
  };
}

function WaitList() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { isSignedIn } = useAuthState();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaitlist, setTotalWaitlist] = useState<number | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  useEffect(() => {
    const isNewSignupEnabled = import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true';

    if (isNewSignupEnabled) {
      navigate('/signup', { replace: true });
      return;
    }

    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  // Fetch waitlist stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/waitlist/stats`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTotalWaitlist(data.data.total);
          }
        }
      } catch (error) {
        console.error('Failed to fetch waitlist stats:', error);
      }
    };
    fetchStats();
  }, []);

  if (isSignedIn) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setShowCaptcha(true);
  };

  const handleCaptchaVerify = async (token: string | null) => {
    if (!token) return;
    setShowCaptcha(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Recaptcha-Token': token,
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          source: 'website',
          marketingConsent,
        }),
      });

      const data: WaitlistResponse = await response.json();

      if (data.success) {
        if (data.data?.hasAccount) {
          toast.info(data.message);
          navigate('/signin');
          return;
        }

        setIsSubmitted(true);
        setPosition(data.data?.position || null);
        toast.success(data.message);
      } else {
        toast.error(data.message || 'Failed to join waitlist');
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      toast.error('Failed to join waitlist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center py-12">
      {/* Spotlight */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={isDark ? '#DDFF00' : '#b5c800'}
      />

      {/* Content */}
      <div className="max-w-9xl flex flex-col items-center relative z-20 gap-6 px-4">
        {/* Logo */}
        <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" className="w-40" alt="Fair Arena Logo" />

        {/* Heading */}
        <h2
          className={`
            text-3xl md:text-5xl font-semibold text-center
            ${isDark ? 'text-neutral-100' : 'text-neutral-900'}
          `}
        >
          Join the Future of{' '}
          <span className={`${isDark ? 'text-[#ddef00]' : 'text-[#1f1f1f]'}`}>Collaboration!</span>
        </h2>

        {/* Subtitle */}
        {totalWaitlist !== null && (
          <p className={`text-lg ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Join <span className="font-bold">{totalWaitlist.toLocaleString()}+</span> people already on the waitlist
          </p>
        )}

        {/* Waitlist Card Wrapper */}
        <div className="w-full flex justify-center">
          <div
            className={`
              p-1 rounded-4xl backdrop-blur-md w-auto max-w-md border
              ${isDark ? 'bg-[#ddef00] border-neutral-800' : 'bg-black border-neutral-300'}
            `}
          >
            {/* Custom Waitlist Form */}
            <div
              className={`
                ${isDark ? 'bg-neutral-900' : 'bg-white'}
                rounded-4xl shadow-none p-6
              `}
            >
              {isSubmitted ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                    You're on the list!
                  </h3>
                  {position && (
                    <p className={`text-lg font-medium mb-2 ${isDark ? 'text-[#ddef00]' : 'text-primary'}`}>
                      Position #{position}
                    </p>
                  )}
                  <p className={`${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    We'll notify you when FairArena launches.
                  </p>
                  <p className={`text-sm mt-4 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    Check your email for confirmation.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                    Join the Waitlist
                  </h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Be the first to know when we launch. Get early access and exclusive features.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`
                        w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#DDEF00] focus:border-transparent outline-none transition-all
                        ${isDark
                          ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-[#777]'
                          : 'bg-white text-neutral-900 border-neutral-300'}
                      `}
                    />
                    <input
                      type="email"
                      placeholder="Your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`
                        w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#DDEF00] focus:border-transparent outline-none transition-all
                        ${isDark
                          ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-[#777]'
                          : 'bg-white text-neutral-900 border-neutral-300'}
                      `}
                    />
                    <label className="flex items-start gap-3 px-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setMarketingConsent(newValue);
                        }}
                        className={`
                        mt-1 w-4 h-4 rounded border outline-none cursor-pointer
                        ${isDark ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-300 bg-white'}
                        accent-[#DDEF00]
                      `}
                      />
                      <span className={`text-sm select-none ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        I agree to receive updates about FairArena.
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`
                        w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                        ${isDark ? 'bg-[#DDEF00] text-black hover:bg-[#DDEF00]/90' : 'bg-black text-white hover:bg-black/90'}
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Joining...
                        </>
                      ) : (
                        'Join Waitlist'
                      )}
                    </button>
                  </form>
                  <p className={`text-xs text-center mt-4 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    No spam, ever. We respect your privacy.
                  </p>
                  <p className={`text-center text-xs mt-2 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    By joining, you agree to our{' '}
                    <Link to="/terms-and-conditions" className="underline hover:text-[#DDEF00] transition-colors">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy-policy" className="underline hover:text-[#DDEF00] transition-colors">
                      Privacy Policy
                    </Link>.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Already have an account? */}
        <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          Already have an account?{' '}
          <button
            onClick={() => navigate('/signin')}
            className={`font-medium underline ${isDark ? 'text-[#ddef00]' : 'text-black'}`}
          >
            Sign in
          </button>
        </p>
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

export default WaitList;
