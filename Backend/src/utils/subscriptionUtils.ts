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
 * Subscription Utility
 *
 * Production-ready utility for checking user subscription levels and enforcing
 * feature access based on subscription tier. Designed to be used as middleware
 * or called directly in controllers.
 *
 * Usage:
 *   import { requireSubscription, getUserSubscription, hasFeatureAccess } from '../utils/subscriptionUtils.js';
 *
 *   // As middleware:
 *   router.get('/premium-feature', protectRoute, requireSubscription(['PRO', 'TEAM', 'ENTERPRISE']), handler);
 *
 *   // In a controller:
 *   const sub = await getUserSubscription(userId);
 *   if (!hasFeatureAccess(sub, 'aiAnalytics')) { return res.status(403)... }
 */

import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from './logger.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';
export type SubscriptionStatus =
  | 'CREATED'
  | 'AUTHENTICATED'
  | 'ACTIVE'
  | 'PENDING'
  | 'HALTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'PAUSED';

export interface ActiveSubscription {
  subscriptionId: string;
  razorpaySubscriptionId: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  planId: string;
  planName: string;
  billingCycle: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  limits: SubscriptionLimits;
}

export interface SubscriptionLimits {
  maxProjects: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
  maxHackathons: number;
  maxParticipantsPerHackathon: number;
  maxJudgesPerHackathon: number;
  prioritySupport: boolean;
  customBranding: boolean;
  advancedAnalytics: boolean;
  aiScoring: boolean;
  plagiarismDetection: boolean;
  dedicatedAccountManager: boolean;
  slaSupport: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

// ─────────────────────────────────────────────
// Default limits per tier
// ─────────────────────────────────────────────

export const TIER_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  FREE: {
    maxProjects: 1,
    maxTeamMembers: 1,
    aiCreditsPerMonth: 0,
    maxHackathons: 1,
    maxParticipantsPerHackathon: 20,
    maxJudgesPerHackathon: 2,
    prioritySupport: false,
    customBranding: false,
    advancedAnalytics: false,
    aiScoring: false,
    plagiarismDetection: false,
    dedicatedAccountManager: false,
    slaSupport: false,
    apiAccess: false,
    whiteLabel: false,
  },
  STARTER: {
    maxProjects: 3,
    maxTeamMembers: 5,
    aiCreditsPerMonth: 100,
    maxHackathons: 3,
    maxParticipantsPerHackathon: 100,
    maxJudgesPerHackathon: 10,
    prioritySupport: false,
    customBranding: false,
    advancedAnalytics: false,
    aiScoring: false,
    plagiarismDetection: false,
    dedicatedAccountManager: false,
    slaSupport: false,
    apiAccess: false,
    whiteLabel: false,
  },
  PRO: {
    maxProjects: 10,
    maxTeamMembers: 10,
    aiCreditsPerMonth: 500,
    maxHackathons: 10,
    maxParticipantsPerHackathon: 500,
    maxJudgesPerHackathon: 30,
    prioritySupport: true,
    customBranding: true,
    advancedAnalytics: true,
    aiScoring: true,
    plagiarismDetection: false,
    dedicatedAccountManager: false,
    slaSupport: false,
    apiAccess: true,
    whiteLabel: false,
  },
  TEAM: {
    maxProjects: 25,
    maxTeamMembers: 50,
    aiCreditsPerMonth: 2000,
    maxHackathons: 25,
    maxParticipantsPerHackathon: 2000,
    maxJudgesPerHackathon: 100,
    prioritySupport: true,
    customBranding: true,
    advancedAnalytics: true,
    aiScoring: true,
    plagiarismDetection: true,
    dedicatedAccountManager: false,
    slaSupport: false,
    apiAccess: true,
    whiteLabel: false,
  },
  ENTERPRISE: {
    maxProjects: -1, // unlimited
    maxTeamMembers: -1,
    aiCreditsPerMonth: -1,
    maxHackathons: -1,
    maxParticipantsPerHackathon: -1,
    maxJudgesPerHackathon: -1,
    prioritySupport: true,
    customBranding: true,
    advancedAnalytics: true,
    aiScoring: true,
    plagiarismDetection: true,
    dedicatedAccountManager: true,
    slaSupport: true,
    apiAccess: true,
    whiteLabel: true,
  },
};

// Tier hierarchy for comparison
const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  TEAM: 3,
  ENTERPRISE: 4,
};

// Cache TTL for subscription data (5 minutes)
const SUBSCRIPTION_CACHE_TTL = 300;

// ─────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────

/**
 * Get the user's current active subscription from DB (with Redis caching).
 * Returns null if the user has no active subscription (FREE tier).
 */
export async function getUserSubscription(userId: string): Promise<ActiveSubscription | null> {
  const cacheKey = `subscription:user:${userId}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      logger.debug('Subscription fetched from cache', { userId });
      return parsed;
    }
  } catch (err) {
    logger.warn('Failed to read subscription from cache', { userId, err });
  }

  // Fetch from DB
  try {
    // Priority 1: Find ACTIVE subscription (Grants full access)
    let subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
      },
      include: {
        plan: {
          select: {
            planId: true,
            name: true,
            tier: true,
            billingCycle: true,
            features: true,
            limits: true,
          },
        },
      },
    });

    // Priority 2: If no active sub, find AUTHENTICATED (Grants no access until active)
    if (!subscription) {
      subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'AUTHENTICATED',
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            select: {
              planId: true,
              name: true,
              tier: true,
              billingCycle: true,
              features: true,
              limits: true,
            },
          },
        },
      });
    }

    if (!subscription) {
      // No active or authenticated subscription found — user is on FREE tier.
      try {
        await redis.setex(cacheKey, 60, JSON.stringify(null));
      } catch {}
      return null;
    }

    const dbLimits = (subscription.plan.limits as Partial<SubscriptionLimits>) || {};
    const tierLimits = TIER_LIMITS[subscription.plan.tier as SubscriptionTier] || TIER_LIMITS.FREE;
    const mergedLimits: SubscriptionLimits = { ...tierLimits, ...dbLimits };

    const isActive = subscription.status === 'ACTIVE';

    // Strict access control: Only ACTIVE status grants tier benefits.
    const effectiveTier = isActive ? (subscription.plan.tier as SubscriptionTier) : 'FREE';
    const effectiveLimits = isActive ? mergedLimits : TIER_LIMITS.FREE;

    const result: ActiveSubscription = {
      subscriptionId: subscription.id,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      tier: effectiveTier,
      status: subscription.status as SubscriptionStatus,
      planId: subscription.plan.planId,
      planName: subscription.plan.name,
      billingCycle: subscription.plan.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: subscription.plan.features,
      limits: effectiveLimits,
    };

    // Cache result
    try {
      await redis.setex(cacheKey, SUBSCRIPTION_CACHE_TTL, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    logger.error('Failed to fetch user subscription', { userId, err });
    return null;
  }
}

/**
 * Get the effective tier for a user (FREE if no active subscription).
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const sub = await getUserSubscription(userId);
  return sub?.tier ?? 'FREE';
}

/**
 * Get the effective limits for a user based on their subscription.
 */
export async function getUserLimits(userId: string): Promise<SubscriptionLimits> {
  const sub = await getUserSubscription(userId);
  return sub?.limits ?? TIER_LIMITS.FREE;
}

/**
 * Check if a user's tier meets the minimum required tier.
 */
export function tierMeetsMinimum(
  userTier: SubscriptionTier,
  minimumTier: SubscriptionTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[minimumTier];
}

/**
 * Check if a user has access to a specific boolean feature.
 */
export function hasFeatureAccess(
  subscription: ActiveSubscription | null,
  feature: keyof Pick<
    SubscriptionLimits,
    | 'prioritySupport'
    | 'customBranding'
    | 'advancedAnalytics'
    | 'aiScoring'
    | 'plagiarismDetection'
    | 'dedicatedAccountManager'
    | 'slaSupport'
    | 'apiAccess'
    | 'whiteLabel'
  >,
): boolean {
  const limits = subscription?.limits ?? TIER_LIMITS.FREE;
  return limits[feature] === true;
}

/**
 * Check if a user is within a numeric limit (-1 = unlimited).
 */
export function isWithinLimit(
  subscription: ActiveSubscription | null,
  limitKey: keyof Pick<
    SubscriptionLimits,
    | 'maxProjects'
    | 'maxTeamMembers'
    | 'aiCreditsPerMonth'
    | 'maxHackathons'
    | 'maxParticipantsPerHackathon'
    | 'maxJudgesPerHackathon'
  >,
  currentCount: number,
): boolean {
  const limits = subscription?.limits ?? TIER_LIMITS.FREE;
  const limit = limits[limitKey] as number;
  if (limit === -1) return true; // unlimited
  return currentCount < limit;
}

/**
 * Invalidate the subscription cache for a user (call after subscription changes).
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  try {
    await redis.del(`subscription:user:${userId}`);
    logger.info('Subscription cache invalidated', { userId });
  } catch (err) {
    logger.warn('Failed to invalidate subscription cache', { userId, err });
  }
}

// ─────────────────────────────────────────────
// Express Middleware
// ─────────────────────────────────────────────

/**
 * Middleware: Require the user to have one of the specified subscription tiers.
 *
 * @example
 * router.get('/ai-feature', protectRoute, requireSubscription(['PRO', 'TEAM', 'ENTERPRISE']), handler);
 */
export function requireSubscription(allowedTiers: SubscriptionTier[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const tier = await getUserTier(userId);
      if (!allowedTiers.includes(tier)) {
        return res.status(403).json({
          success: false,
          message: 'This feature requires a higher subscription plan.',
          requiredTiers: allowedTiers,
          currentTier: tier,
          upgradeUrl: '/dashboard/subscription',
        });
      }
      // Attach tier to request for downstream use
      (req as Request & { subscriptionTier: SubscriptionTier }).subscriptionTier = tier;
      next();
    } catch (err) {
      logger.error('Subscription check middleware failed', { userId, err });
      return res.status(500).json({ success: false, message: 'Failed to verify subscription' });
    }
  };
}

/**
 * Middleware: Require at least a minimum tier (inclusive).
 *
 * @example
 * router.post('/hackathon', protectRoute, requireMinimumTier('STARTER'), handler);
 */
export function requireMinimumTier(minimumTier: SubscriptionTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const tier = await getUserTier(userId);
      if (!tierMeetsMinimum(tier, minimumTier)) {
        return res.status(403).json({
          success: false,
          message: `This feature requires the ${minimumTier} plan or higher.`,
          minimumTier,
          currentTier: tier,
          upgradeUrl: '/dashboard/subscription',
        });
      }
      (req as Request & { subscriptionTier: SubscriptionTier }).subscriptionTier = tier;
      next();
    } catch (err) {
      logger.error('Minimum tier check middleware failed', { userId, err });
      return res.status(500).json({ success: false, message: 'Failed to verify subscription' });
    }
  };
}
