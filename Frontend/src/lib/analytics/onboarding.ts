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

/**
 * Onboarding Analytics
 * Tracks user progress through onboarding flow
 */

interface OnboardingEventData {
  step?: number;
  action?: string;
  timestamp: number;
}

/**
 * Track onboarding started event
 */
export function trackOnboardingStarted(): void {
  try {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', 'onboarding_started', {
        timestamp: Date.now(),
      });
    }

    // TODO: Send to analytics service (Google Analytics, Amplitude, etc.)
    // Example: gtag('event', 'onboarding_started', { ... });
  } catch (error) {
    console.error('Failed to track onboarding_started:', error);
  }
}

/**
 * Track onboarding step viewed
 */
export function trackOnboardingStepViewed(step: number): void {
  try {
    const data: OnboardingEventData = {
      step,
      timestamp: Date.now(),
    };

    if (import.meta.env.DEV) {
      console.log('[Analytics] onboarding_step_viewed', data);
    }

    // TODO: Send to analytics service
  } catch (error) {
    console.error('Failed to track onboarding_step_viewed:', error);
  }
}

/**
 * Track onboarding step completed
 */
export function trackOnboardingStepCompleted(step: number): void {
  try {
    const data: OnboardingEventData = {
      step,
      action: 'completed',
      timestamp: Date.now(),
    };

    if (import.meta.env.DEV) {
      console.log('[Analytics] onboarding_step_completed', data);
    }

    // TODO: Send to analytics service
  } catch (error) {
    console.error('Failed to track onboarding_step_completed:', error);
  }
}

/**
 * Track onboarding completed
 */
export function trackOnboardingCompleted(): void {
  try {
    const data: OnboardingEventData = {
      action: 'completed',
      timestamp: Date.now(),
    };

    if (import.meta.env.DEV) {
      console.log('[Analytics] onboarding_completed', data);
    }

    // TODO: Send to analytics service
  } catch (error) {
    console.error('Failed to track onboarding_completed:', error);
  }
}

/**
 * Track onboarding skipped
 */
export function trackOnboardingSkipped(lastStep: number): void {
  try {
    const data: OnboardingEventData = {
      step: lastStep,
      action: 'skipped',
      timestamp: Date.now(),
    };

    if (import.meta.env.DEV) {
      console.log('[Analytics] onboarding_skipped', data);
    }

    // TODO: Send to analytics service
  } catch (error) {
    console.error('Failed to track onboarding_skipped:', error);
  }
}
