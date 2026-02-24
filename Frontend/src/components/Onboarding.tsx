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

import { useAuth } from '@/lib/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trophy, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useTheme } from '../hooks/useTheme';
import {
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingStepViewed,
} from '../lib/analytics/onboarding';

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentStep, setCurrentStep, completeOnboarding, skipOnboarding, trackStep } =
    useOnboarding();
  const [isCompleting, setIsCompleting] = useState(false);

  // Track onboarding start on mount
  useEffect(() => {
    trackOnboardingStarted();
    trackOnboardingStepViewed(1);
  }, []);

  // Track step changes
  useEffect(() => {
    if (currentStep > 1) {
      trackOnboardingStepViewed(currentStep);
    }
  }, [currentStep]);

  const handleNext = async () => {
    trackOnboardingStepCompleted(currentStep);
    trackStep(currentStep); // Fire-and-forget, don't await

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    try {
      trackOnboardingSkipped(currentStep);
      await skipOnboarding();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };

  const handleComplete = async () => {
    try {
      setIsCompleting(true);
      trackOnboardingCompleted();
      await completeOnboarding();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isCompleting) {
        handleNext();
      } else if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isCompleting]);

  // Check for prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animationDuration = prefersReducedMotion ? 0 : 0.15; // 150ms or instant

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isDark ? 'bg-black/80' : 'bg-gray-900/20'
      } backdrop-blur-md`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className={`relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl ${
          isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
        }`}
      >
        {/* Skip button - always visible, one click */}
        <button
          onClick={handleSkip}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          aria-label="Skip onboarding"
          title="Skip (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress indicator */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                  i < currentStep ? 'bg-[#DDEF00]' : isDark ? 'bg-neutral-800' : 'bg-gray-200'
                }`}
                role="progressbar"
                aria-valuenow={currentStep}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
              />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="px-8 pb-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
              transition={{ duration: animationDuration }}
            >
              {currentStep === 1 && <WelcomeStep user={user} isDark={isDark} />}
              {currentStep === 2 && <FeaturesStep isDark={isDark} />}
              {currentStep === 3 && <QuickTourStep isDark={isDark} />}
              {currentStep === 4 && <PreferencesStep isDark={isDark} />}
              {currentStep === 5 && <LaunchStep user={user} isDark={isDark} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div
          className={`px-8 py-6 flex items-center justify-between border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}
        >
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentStep === 1
                ? 'opacity-0 pointer-events-none'
                : isDark
                  ? 'hover:bg-neutral-800 text-neutral-300'
                  : 'hover:bg-gray-100 text-gray-700'
            }`}
            aria-label="Previous step"
          >
            Previous
          </button>

          <div className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {currentStep} / {TOTAL_STEPS}
          </div>

          <button
            onClick={handleNext}
            disabled={isCompleting}
            className="px-6 py-2.5 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
            aria-label={currentStep === TOTAL_STEPS ? 'Complete onboarding' : 'Next step'}
          >
            {isCompleting ? 'Completing...' : currentStep === TOTAL_STEPS ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Step components
function WelcomeStep({ user, isDark }: { user: any; isDark: boolean }) {
  return (
    <div className="space-y-6 py-8">
      <div className={`text-6xl`}>👋</div>
      <h1
        id="onboarding-title"
        className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Welcome, {user?.firstName || 'there'}!
      </h1>
      <p className={`text-lg ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
        We're excited to have you on FairArena. Let's take a quick tour to get you started.
      </p>
    </div>
  );
}

function FeaturesStep({ isDark }: { isDark: boolean }) {
  const features = [
    {
      icon: <Trophy className="w-6 h-6" />,
      title: 'Fair Judging',
      description: 'Transparent, bias-free evaluation of hackathon teams',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Team Management',
      description: 'Organize and collaborate with your teams effortlessly',
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'Credits System',
      description: 'Earn and spend credits for premium features',
    },
  ];

  return (
    <div className="space-y-6 py-8">
      <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Core Features
      </h2>
      <div className="grid gap-4">
        {features.map((feature, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${
              isDark
                ? 'bg-neutral-800/50 border-neutral-700 hover:border-[#DDEF00]/50'
                : 'bg-gray-50 border-gray-200 hover:border-[#DDEF00]'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-neutral-700' : 'bg-white'}`}>
                {feature.icon}
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickTourStep({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-6 py-8">
      <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Quick Tour
      </h2>
      <div className="space-y-4">
        <div
          className={`p-4 rounded-xl ${isDark ? 'bg-[#DDEF00]/10 border border-[#DDEF00]/20' : 'bg-[#DDEF00]/10 border border-[#DDEF00]/30'}`}
        >
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>💡 Pro Tip</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            Use the sidebar to navigate between Dashboard, Teams, and Settings
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            🔔 Notifications
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            Check your inbox in the top right for important updates
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ⚡ Quick Actions
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            Use keyboard shortcuts for faster navigation (Cmd/Ctrl + K)
          </p>
        </div>
      </div>
    </div>
  );
}

function PreferencesStep({ isDark }: { isDark: boolean }) {
  const { setTheme, theme } = useTheme();

  return (
    <div className="space-y-6 py-8">
      <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Customize Your Experience
      </h2>
      <div className="space-y-4">
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}
          >
            Theme Preference
          </label>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t as 'light' | 'dark' | 'system')}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  theme === t
                    ? 'bg-[#DDEF00] text-black'
                    : isDark
                      ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
          You can change these settings anytime in Account Settings
        </p>
      </div>
    </div>
  );
}

function LaunchStep({ user, isDark }: { user: any; isDark: boolean }) {
  return (
    <div className="space-y-6 py-8 text-center">
      <div className="text-6xl">🚀</div>
      <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        You're All Set!
      </h2>
      <p className={`text-lg ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
        You're ready to start using FairArena, {user?.firstName}. Let's build something amazing
        together!
      </p>
      <div
        className={`inline-block p-4 rounded-xl ${isDark ? 'bg-[#DDEF00]/10' : 'bg-[#DDEF00]/20'}`}
      >
        <p className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          🎁 Welcome Bonus: Check your inbox for free credits!
        </p>
      </div>
    </div>
  );
}
