import Razorpay from 'razorpay';
import { ENV } from './env.js';

// Initialize Razorpay only if keys are available
export const razorpay =
  ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: ENV.RAZORPAY_KEY_ID,
        key_secret: ENV.RAZORPAY_KEY_SECRET,
      })
    : null;

// One-time payment plans configuration (easily modifiable)
export const PAYMENT_PLANS = {
  basic: {
    id: 'basic_plan',
    name: 'Basic Plan',
    amount: 89900, // Amount in paisa (₹899)
    currency: 'INR',
    credits: 50, // Credits awarded after payment
    description: 'Perfect for small hackathons & student-led events',
    features: [
      '50 Participants',
      '5 Judges',
      'Manual Scoring System',
      'Basic Real-time Leaderboard',
      'Submission Management',
      'Email Support',
    ],
  },
  business: {
    id: 'business_plan',
    name: 'Business Plan',
    amount: 299900, // Amount in paisa (₹2999)
    currency: 'INR',
    credits: 300, // Credits awarded after payment
    description: 'Our most popular plan with AI-powered scoring',
    features: [
      '300 Participants',
      '20 Judges',
      'AI Website Analysis',
      'Advanced Leaderboard',
      'Judge Collaboration Tools',
      'AI Scoring Assistance',
      'Priority Support',
    ],
  },
  enterprise: {
    id: 'enterprise_plan',
    name: 'Enterprise Plan',
    amount: 0, // Custom pricing - will be handled separately
    currency: 'INR',
    credits: 0, // Custom credits
    description: 'For large-scale, enterprise-grade hackathons',
    features: [
      'Unlimited Participants',
      'Unlimited Judges',
      'Deep AI Analytics',
      'Plagiarism Detection',
      'Custom Rubrics & Permissions',
      'Dedicated Account Manager',
      'SLA-backed Support',
    ],
  },
} as const;

export type PaymentPlan = keyof typeof PAYMENT_PLANS;

// Get plan by ID
export function getPlanById(planId: string): (typeof PAYMENT_PLANS)[PaymentPlan] | null {
  const plan = Object.values(PAYMENT_PLANS).find((p) => p.id === planId);
  return plan || null;
}

// Validate plan exists and is not custom pricing
export function validatePlan(planId: string): {
  valid: boolean;
  plan?: (typeof PAYMENT_PLANS)[PaymentPlan];
  error?: string;
} {
  const plan = getPlanById(planId);
  if (!plan) {
    return { valid: false, error: 'Invalid plan ID' };
  }

  if (plan.amount === 0) {
    return { valid: false, error: 'Custom pricing plans require manual processing' };
  }

  return { valid: true, plan };
}
