import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function Signin() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/v1/auth/google?redirect=/dashboard`);
      const result = await response.json();

      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to initiate Google login');
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`
        fixed inset-0 w-full min-h-screen flex items-center justify-center overflow-hidden
        ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}
      `}
    >
      {/* MAIN CONTAINER */}
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
          <h1
            className={`
              text-3xl font-bold mb-1
              ${isDark ? 'text-white' : 'text-neutral-900'}
            `}
          >
            Welcome Back
          </h1>

          <p
            className={`
              mb-6
              ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
            `}
          >
            Enter your credentials to access your account.
          </p>

          <div className="w-full max-w-sm px-4">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full mb-4 py-3 px-4 flex items-center justify-center gap-3 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative my-6">
              <div className={`absolute inset-0 flex items-center ${isDark ? 'opacity-30' : 'opacity-20'}`}>
                <div className={`w-full border-t ${isDark ? 'border-neutral-600' : 'border-neutral-300'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-white text-neutral-500'}`}>
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={`
                    w-full px-4 py-3 rounded-lg border transition-colors
                    ${isDark
                      ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]'
                      : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'
                    }
                    focus:outline-none focus:ring-0
                  `}
                />
              </div>

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
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`
                    w-full px-4 py-3 rounded-lg border transition-colors
                    ${isDark
                      ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]'
                      : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'
                    }
                    focus:outline-none focus:ring-0
                  `}
                />
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className={`text-sm ${isDark ? 'text-[#DDEF00] hover:text-[#f0ff33]' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className={`text-center text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className={`font-medium ${isDark ? 'text-[#DDEF00] hover:text-[#f0ff33]' : 'text-neutral-900 hover:underline'}`}
                >
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* RIGHT SIDE — ILLUSTRATION */}
        <div
          className={`
            hidden md:flex w-1/2 items-center justify-center p-6
            ${isDark
              ? 'bg-[#0f0f0f] border-l border-neutral-800'
              : 'bg-[#EEF0FF] border-l border-neutral-200'
            }
          `}
        >
          <div className="relative w-full max-w-md">
            <h2
              className={`
                text-2xl font-semibold mb-4
                ${isDark ? 'text-white' : 'text-neutral-900'}
              `}
            >
              Perfectly Judge Hackathon Teams and View LeaderBoards.
            </h2>
            <p
              className={`
                mb-6 text-sm
                ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
              `}
            >
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
    </div>
  );
}
