import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { publicApiFetch } from '@/lib/apiClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock, Loader2, Sparkles, Trophy, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { isSignedIn } = useAuthState();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
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

  // Fetch waitlist stats
  const { data: statsData } = useQuery({
    queryKey: ['waitlist-stats'],
    queryFn: async () => {
      const res = await publicApiFetch(`${API_BASE}/api/v1/waitlist/stats`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch stats');
      return data;
    },
    enabled: !isSignedIn,
  });

  useEffect(() => {
    if (statsData?.success) {
      setTotalWaitlist(statsData.data.total);
    }
  }, [statsData]);

  // Join waitlist mutation
  const joinMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await publicApiFetch(`${API_BASE}/api/v1/waitlist`, {
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
      if (!response.ok) throw new Error(data.message || 'Failed to join waitlist');
      return data;
    },
    onSuccess: (data) => {
      if (data.data?.hasAccount) {
        toast.info(data.message);
        navigate('/signin');
        return;
      }
      setIsSubmitted(true);
      setPosition(data.data?.position || null);
      toast.success(data.message);
    },
    onError: (error: Error) => {
      console.error('Waitlist error:', error);
      toast.error(error.message || 'Failed to join waitlist. Please try again.');
    },
  });

  const isLoading = joinMutation.isPending;

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
    joinMutation.mutate(token);
  };

  return (
    <div className="fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div className="w-full h-screen flex flex-col md:flex-row overflow-hidden">
        {/* LEFT SIDE — FORM */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center h-full relative z-10 bg-[#0a0a0a]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.8 }}
            className="w-full h-full overflow-y-auto no-scrollbar py-8 px-6 flex flex-col items-center"
          >
            <div className="w-full max-w-sm px-4 flex flex-col justify-center h-full">
              {/* Header */}
              {!isSubmitted && (
                <div className="mb-8 text-center">
                  <img
                    src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
                    className="h-10 mx-auto mb-6"
                    alt="FairArena Logo"
                  />
                  <h1 className="text-3xl font-bold mb-2 text-white">Join the Waitlist</h1>
                  <p className="text-neutral-400">Be the first to experience the future</p>
                  {totalWaitlist !== null && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mx-auto">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DDEF00] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#DDEF00]"></span>
                      </span>
                      <span className="text-xs text-neutral-300">
                        <strong className="text-white">{totalWaitlist.toLocaleString()}</strong>{' '}
                        people waiting
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Success State */}
              {isSubmitted ? (
                <div className="text-center py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-20 h-20 mx-auto rounded-full bg-[#DDEF00]/10 flex items-center justify-center ring-1 ring-[#DDEF00]/20">
                    <CheckCircle2 className="w-10 h-10 text-[#DDEF00]" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-white">You're on the list!</h3>
                    {position && (
                      <div className="inline-block px-4 py-1.5 rounded-full bg-[#DDEF00]/10 text-[#DDEF00] font-medium border border-[#DDEF00]/20">
                        Position #{position.toLocaleString()}
                      </div>
                    )}
                    <p className="text-neutral-400 max-w-xs mx-auto">
                      We'll send an email to{' '}
                      <span className="font-semibold text-white">{email}</span> when your spot opens
                      up.
                    </p>
                    <Button
                      onClick={() => navigate('/')}
                      variant="outline"
                      className="mt-6 border-neutral-800 bg-transparent text-white hover:bg-neutral-800 hover:text-white"
                    >
                      Return Home
                    </Button>
                  </div>
                </div>
              ) : (
                /* Form State */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-300">
                      Name <span className="text-neutral-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-start gap-3 py-2">
                    <Checkbox
                      id="marketing"
                      checked={marketingConsent}
                      onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                      className="mt-1 data-[state=checked]:bg-[#DDEF00] data-[state=checked]:border-[#DDEF00] data-[state=checked]:text-black border-neutral-600"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="marketing"
                        className="text-sm font-medium leading-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-neutral-400"
                      >
                        I want to receive product updates and announcements.
                      </Label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)] flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Waitlist'
                    )}
                  </button>

                  <div className="pt-4 text-center">
                    <p className="text-sm text-neutral-500">
                      Already have an account?{' '}
                      <Link
                        to="/signin"
                        className="font-medium text-[#DDEF00] hover:text-[#efff5e] transition-colors"
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
                    <p className="text-xs text-neutral-600">
                      By joining, you agree to our{' '}
                      <Link
                        to="/terms-and-conditions"
                        className="hover:text-white transition-colors underline decoration-neutral-700"
                      >
                        Terms
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
              )}
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE — ILLUSTRATION */}
        <AuthIllustration
          title="Secure your early access"
          subtitle="Join the exclusive early access program and be the first to experience the next level of project management."
          icon={<Sparkles className="w-10 h-10 text-black font-bold" />}
          features={[
            { icon: Clock, text: 'Priority Access', desc: 'First in line' },
            { icon: Trophy, text: 'Founder Badge', desc: 'Exclusive reward' },
            { icon: Bell, text: 'Live Updates', desc: 'Status alerts' },
            { icon: Zap, text: 'Beta Testing', desc: 'Try new features' },
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
    </div>
  );
}

export default WaitList;
