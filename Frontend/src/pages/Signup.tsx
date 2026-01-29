import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { OAuthBanner } from '@/components/auth/OAuthBanner';
import { OAuthSocials } from '@/components/auth/OAuthSocials';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { FolderCode, Globe, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function Signup() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>(null);

  useEffect(() => {
    const savedMethod = localStorage.getItem('lastUsedAuthMethod');
    if (savedMethod) {
      setLastUsedMethod(savedMethod);
    }
  }, []);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  // Redirect if already authenticated or if signup is disabled
  useEffect(() => {
    const isNewSignupEnabled = import.meta.env.VITE_NEW_SIGNUP_ENABLED === 'true';

    if (!isNewSignupEnabled) {
      navigate('/waitlist', { replace: true });
      return;
    }

    // Check for add_account flow - don't redirect in this case
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow');
    if (flow === 'add_account') {
      return; // Allow user to add another account without redirecting
    }

    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Persist OAuth request across signup flow
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
      window.history.replaceState({}, document.title, `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/\d/.test(password)) errors.push('One number');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      setError(`Password must have: ${passwordErrors.join(', ')}`);
      return;
    }

    setShowCaptcha(true);
  };

  const handleCaptchaVerify = async (token: string | null) => {
    if (!token) return;
    setShowCaptcha(false);
    setIsLoading(true);

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      }, token);
      setSuccess(true);
      toast.success('Registration successful! Please check your email to verify your account.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={`
          fixed inset-0 w-full min-h-screen flex items-center justify-center
          ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}
        `}
      >
        <div className={`max-w-md p-8 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Check your email
          </h2>
          <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            We've sent a verification link to <strong>{formData.email}</strong>. Click the link to verify your account.
          </p>
          <Link
            to={`/signin${sessionStorage.getItem('oauth_request_id') ? `?oauth_request=${sessionStorage.getItem('oauth_request_id')}` : ''}`}
            state={location.state}
            className="inline-block py-3 px-6 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }


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
              transition={{ duration: 1, delay: 1.8 }}
              className="w-full h-full overflow-y-auto no-scrollbar py-8 px-6 flex flex-col items-center"
            >
              <div className="w-full max-w-sm mt-auto mb-auto">
                <div className="mb-8 text-center">
                  <img
                    src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
                    className="h-10 mx-auto mb-6"
                    alt="FairArena Logo"
                  />
                  <h1 className="text-3xl font-bold mb-2 text-white">
                    Create your account
                  </h1>
                  <p className="text-neutral-400">
                    Join thousands of developers building on FairArena
                  </p>
                </div>

                <OAuthSocials
                  getRedirectPath={() => location.state?.from?.pathname || '/dashboard'}
                  lastUsedMethod={lastUsedMethod}
                />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center opacity-20">
                    <div className="w-full border-t border-neutral-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="px-4 bg-[#0a0a0a] text-neutral-500">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="firstName" className="block text-sm font-medium text-neutral-300">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="lastName" className="block text-sm font-medium text-neutral-300">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="name@company.com"
                      className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Create a password"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                    />
                    <p className="text-xs text-neutral-500">
                      Must contain at least 8 characters, 1 uppercase, 1 lowercase, and 1 number
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-300">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl border bg-white/5 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-[#DDEF00] focus:ring-1 focus:ring-[#DDEF00] transition-all outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#DDEF00] hover:bg-[#cbe600] text-black rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(221,239,0,0.2)] hover:shadow-[0_0_30px_rgba(221,239,0,0.3)]"
                  >
                    {isLoading ? 'Creating account...' : 'Create account'}
                  </button>

                  <p className="text-center text-sm text-neutral-500 pt-4">
                    Already have an account?{' '}
                    <Link to="/signin" className="font-medium text-[#DDEF00] hover:text-[#efff5e] transition-colors">
                      Sign in here
                    </Link>
                  </p>
                </form>

                <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
                  <p className="text-xs text-neutral-600">
                    By clicking create account, you agree to our{' '}
                    <Link to="/terms-and-conditions" className="hover:text-white transition-colors underline decoration-neutral-700">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy-policy" className="hover:text-white transition-colors underline decoration-neutral-700">Privacy Policy</Link>.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT SIDE — ILLUSTRATION */}
          <AuthIllustration
            title="Join the FairArena community"
            subtitle="Connect with thousands of developers, find your ideal team, and build projects that matter."
            icon={<Users className="w-10 h-10 text-black font-bold" />}
            features={[
              { icon: User, text: "Developer Profiles", desc: "Showcase your skills" },
              { icon: Users, text: "Team Matching", desc: "Find collaborators" },
              { icon: FolderCode, text: "Project Hub", desc: "Manage submissions" },
              { icon: Globe, text: "Global Access", desc: "Work from anywhere" }
            ]}
          />
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
      </div>
    </>
  );
}
