import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Signup() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();

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

    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

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

  const handleGoogleSignup = () => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const redirectPath = location.state?.from?.pathname || '/dashboard';
    window.location.href = `${apiUrl}/api/v1/auth/google?redirect=${encodeURIComponent(redirectPath)}`;
  };

  const handleGithubSignup = () => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const redirectPath = location.state?.from?.pathname || '/dashboard';
    window.location.href = `${apiUrl}/api/v1/auth/github?redirect=${encodeURIComponent(redirectPath)}`;
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
            to="/signin"
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
    <div
      className={`
        fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden
        ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}
      `}
    >
      <div
        className={`
          w-full h-screen
          flex flex-col md:flex-row rounded-none overflow-hidden
          shadow-[0_0_80px_rgba(0,0,0,0.2)]
        `}
      >
        {/* LEFT SIDE — AUTH FORM */}
        <div
          className={`
            w-full md:w-1/2 flex flex-col py-5 items-center justify-start h-auto overflow-scroll overflow-x-hidden no-scrollbar
            ${isDark ? 'bg-neutral-900' : 'bg-white'}
          `}
        >
          <img
            src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png"
            className="w-30"
            alt="Fair Arena Logo"
          />
          <h1 className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Create Your Account
          </h1>
          <p className={`mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Sign up to access your dashboard and tools.
          </p>

          <div className="w-full max-w-sm px-4">
            {/* Google Sign Up Button */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              className="w-full mb-4 py-3 px-4 flex items-center justify-center gap-3 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-medium transition-all active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* GitHub Sign Up Button */}
            <button
              type="button"
              onClick={handleGithubSignup}
              className={`w-full mb-4 py-3 px-4 flex items-center justify-center gap-3 rounded-lg font-medium transition-all active:scale-95 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-neutral-900 hover:bg-neutral-800 text-white'}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Continue with GitHub
            </button>

            <div className="relative my-4">
              <div className={`absolute inset-0 flex items-center ${isDark ? 'opacity-30' : 'opacity-20'}`}>
                <div className={`w-full border-t ${isDark ? 'border-neutral-600' : 'border-neutral-300'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-white text-neutral-500'}`}>
                  or sign up with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                />
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Min 8 chars, 1 uppercase, 1 lowercase, 1 number
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <p className={`text-center text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Already have an account?{' '}
                <Link to="/signin" className={`font-medium ${isDark ? 'text-[#DDEF00]' : 'text-neutral-900 hover:underline'}`}>
                  Sign in
                </Link>
              </p>
              <p className={`text-center text-xs mt-4 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                By creating an account, you agree to our{' '}
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
        </div>

        {/* RIGHT SIDE — ILLUSTRATION */}
        <div className={`hidden md:flex w-1/2 items-center justify-center p-6 ${isDark ? 'bg-[#0f0f0f] border-l border-neutral-800' : 'bg-[#EEF0FF] border-l border-neutral-200'}`}>
          <div className="relative w-full max-w-md">
            <h2 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              Perfectly Judge Hackathon Teams and View LeaderBoards.
            </h2>
            <p className={`mb-6 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Log in to access your CRM dashboard and manage your team.
            </p>
            <img
              src="https://fairarena.blob.core.windows.net/fairarena/Dashboard Preview"
              alt="Dashboard Preview"
              className="rounded-xl shadow-lg border"
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
