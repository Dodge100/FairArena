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
 * subscriptionUtils.test.ts
 *
 * Unit tests for the subscription utility — tier ranks, limits,
 * feature access, and Express middleware (requireSubscription, requireMinimumTier).
 * No real DB or Redis — all mocked via setup.ts globals.
 */
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock dependencies ────────────────────────────────────────────────────────
vi.mock('../../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../../config/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { redis } from '../../../config/redis.js';
import {
  hasFeatureAccess,
  invalidateSubscriptionCache,
  isWithinLimit,
  requireMinimumTier,
  requireSubscription,
  TIER_LIMITS,
  tierMeetsMinimum,
  type ActiveSubscription,
  type SubscriptionTier,
} from '../../../utils/subscriptionUtils.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mockRes = () => {
  const r: Partial<Response> = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  return r as Response;
};
const mockNext = () => vi.fn() as unknown as NextFunction;
const makeReq = (userId?: string) =>
  ({ user: userId ? { userId } : undefined }) as unknown as Request;

const buildSub = (tier: SubscriptionTier): ActiveSubscription => ({
  subscriptionId: 'sub_1',
  razorpaySubscriptionId: null,
  tier,
  status: 'ACTIVE',
  planId: 'plan_1',
  planName: tier + ' Plan',
  billingCycle: 'monthly',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  features: [],
  limits: TIER_LIMITS[tier],
});

// ════════════════════════════════════════════════════════════════════════════
// 1. TIER_LIMITS
// ════════════════════════════════════════════════════════════════════════════
describe('TIER_LIMITS constants', () => {
  it('FREE tier has no AI credits', () => {
    expect(TIER_LIMITS.FREE.aiCreditsPerMonth).toBe(0);
    expect(TIER_LIMITS.FREE.apiAccess).toBe(false);
  });

  it('ENTERPRISE tier has unlimited resources (-1)', () => {
    expect(TIER_LIMITS.ENTERPRISE.maxProjects).toBe(-1);
    expect(TIER_LIMITS.ENTERPRISE.maxTeamMembers).toBe(-1);
  });

  it('PRO tier has AI scoring and custom branding', () => {
    expect(TIER_LIMITS.PRO.aiScoring).toBe(true);
    expect(TIER_LIMITS.PRO.customBranding).toBe(true);
  });

  it('STARTER tier has no custom branding', () => {
    expect(TIER_LIMITS.STARTER.customBranding).toBe(false);
  });

  it('TEAM has plagiarismDetection', () => {
    expect(TIER_LIMITS.TEAM.plagiarismDetection).toBe(true);
  });

  it("FREE doesn't have plagiarismDetection", () => {
    expect(TIER_LIMITS.FREE.plagiarismDetection).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. tierMeetsMinimum
// ════════════════════════════════════════════════════════════════════════════
describe('tierMeetsMinimum', () => {
  it.each([
    ['ENTERPRISE', 'FREE', true],
    ['ENTERPRISE', 'ENTERPRISE', true],
    ['PRO', 'STARTER', true],
    ['FREE', 'STARTER', false],
    ['STARTER', 'PRO', false],
    ['TEAM', 'TEAM', true],
  ] as [SubscriptionTier, SubscriptionTier, boolean][])(
    '%s vs minimum %s → %s',
    (user, min, expected) => {
      expect(tierMeetsMinimum(user, min)).toBe(expected);
    },
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 3. hasFeatureAccess
// ════════════════════════════════════════════════════════════════════════════
describe('hasFeatureAccess', () => {
  it('returns false for null subscription (FREE limits)', () => {
    expect(hasFeatureAccess(null, 'apiAccess')).toBe(false);
    expect(hasFeatureAccess(null, 'prioritySupport')).toBe(false);
  });

  it('returns true for enterprise features in ENTERPRISE sub', () => {
    const sub = buildSub('ENTERPRISE');
    expect(hasFeatureAccess(sub, 'whiteLabel')).toBe(true);
    expect(hasFeatureAccess(sub, 'dedicatedAccountManager')).toBe(true);
    expect(hasFeatureAccess(sub, 'slaSupport')).toBe(true);
  });

  it('returns true for PRO features in PRO sub', () => {
    const sub = buildSub('PRO');
    expect(hasFeatureAccess(sub, 'aiScoring')).toBe(true);
    expect(hasFeatureAccess(sub, 'customBranding')).toBe(true);
  });

  it('returns false for enterprise-only features in PRO sub', () => {
    const sub = buildSub('PRO');
    expect(hasFeatureAccess(sub, 'whiteLabel')).toBe(false);
    expect(hasFeatureAccess(sub, 'dedicatedAccountManager')).toBe(false);
  });

  it('returns true for all features in ENTERPRISE', () => {
    const sub = buildSub('ENTERPRISE');
    const features: Array<keyof typeof TIER_LIMITS.ENTERPRISE> = [
      'prioritySupport',
      'customBranding',
      'advancedAnalytics',
      'aiScoring',
      'plagiarismDetection',
      'dedicatedAccountManager',
      'slaSupport',
      'apiAccess',
      'whiteLabel',
    ];
    features.forEach((f) => {
      if (typeof TIER_LIMITS.ENTERPRISE[f] === 'boolean') {
        // @ts-expect-error dynamic feature key
        expect(hasFeatureAccess(sub, f)).toBe(true);
      }
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. isWithinLimit
// ════════════════════════════════════════════════════════════════════════════
describe('isWithinLimit', () => {
  it('returns true for unlimited (-1) regardless of count', () => {
    const sub = buildSub('ENTERPRISE');
    expect(isWithinLimit(sub, 'maxProjects', 99999)).toBe(true);
    expect(isWithinLimit(sub, 'maxTeamMembers', 1000000)).toBe(true);
  });

  it('returns false when count meets the limit', () => {
    const sub = buildSub('FREE');
    // FREE: maxProjects = 1, currentCount must be < 1 → 0 is ok, 1 is not
    expect(isWithinLimit(sub, 'maxProjects', 1)).toBe(false);
  });

  it('returns true when count is below the limit', () => {
    const sub = buildSub('STARTER');
    // STARTER: maxProjects = 3
    expect(isWithinLimit(sub, 'maxProjects', 2)).toBe(true);
  });

  it('uses FREE limits when subscription is null', () => {
    // FREE: maxHackathons = 1
    expect(isWithinLimit(null, 'maxHackathons', 0)).toBe(true);
    expect(isWithinLimit(null, 'maxHackathons', 1)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. invalidateSubscriptionCache
// ════════════════════════════════════════════════════════════════════════════
describe('invalidateSubscriptionCache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls redis.del with the correct key', async () => {
    await invalidateSubscriptionCache('user_abc');
    expect(redis.del).toHaveBeenCalledWith('subscription:user:user_abc');
  });

  it('does not throw when redis.del fails', async () => {
    (redis.del as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Redis down'));
    await expect(invalidateSubscriptionCache('user_xyz')).resolves.not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. requireSubscription middleware
// ════════════════════════════════════════════════════════════════════════════
describe('requireSubscription middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no user is attached', async () => {
    const mw = requireSubscription(['PRO']);
    const req = makeReq(undefined);
    const res = mockRes();
    const next = mockNext();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. requireMinimumTier middleware
// ════════════════════════════════════════════════════════════════════════════
describe('requireMinimumTier middleware', () => {
  it('returns 401 when no user', async () => {
    const mw = requireMinimumTier('STARTER');
    const req = makeReq(undefined);
    const res = mockRes();
    const next = mockNext();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
