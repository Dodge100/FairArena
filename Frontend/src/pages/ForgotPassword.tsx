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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function ForgotPassword() {
  const { isDark } = useTheme();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowCaptcha(true);
  };

  const handleCaptchaVerify = async (token: string | null) => {
    if (!token) return;
    setShowCaptcha(false);
    setIsLoading(true);

    try {
      await forgotPassword(email, token);
      setSuccess(true);
      toast.success('Password reset email sent!');
    } catch (err) {
      // Still show success to prevent email enumeration
      setSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}
      >
        <div
          className={`max-w-md p-8 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#DDEF00]/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#DDEF00]"
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
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Check your email
          </h2>
          <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            If an account exists for <strong>{email}</strong>, you will receive a password reset
            link.
          </p>
          <Link
            to="/signin"
            className="inline-block py-3 px-6 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}
    >
      <div className={`w-full max-w-md p-8 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
        <div className="text-center mb-6">
          <img
            src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
            className="w-24 mx-auto mb-4"
            alt="FairArena Logo"
          />
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Forgot Password?
          </h1>
          <p className={`mt-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <p className={`text-center text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Remember your password?{' '}
            <Link
              to="/signin"
              className={`font-medium ${isDark ? 'text-[#DDEF00]' : 'text-neutral-900 hover:underline'}`}
            >
              Sign in
            </Link>
          </p>
        </form>
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
