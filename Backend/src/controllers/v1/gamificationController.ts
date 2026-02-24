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

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../utils/logger.js';

// ─── Constants / Helpers ──────────────────────────────────────────────────────

const SPENDING_TIERS = [
  { key: 'bronze', label: 'Bronze', minPaise: 0, color: '#cd7f32' },
  { key: 'silver', label: 'Silver', minPaise: 20_000, color: '#c0c0c0' }, // ₹200
  { key: 'gold', label: 'Gold', minPaise: 50_000, color: '#ffd700' }, // ₹500
  { key: 'diamond', label: 'Diamond', minPaise: 200_000, color: '#b9f2ff' }, // ₹2,000
  { key: 'legend', label: 'Legend', minPaise: 500_000, color: '#a855f7' }, // ₹5,000
] as const;

const XP_LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000];

function getTierInfo(totalSpentPaise: number) {
  let tierIndex = 0;
  for (let i = SPENDING_TIERS.length - 1; i >= 0; i--) {
    if (totalSpentPaise >= SPENDING_TIERS[i].minPaise) {
      tierIndex = i;
      break;
    }
  }
  const current = SPENDING_TIERS[tierIndex];
  const next = SPENDING_TIERS[tierIndex + 1] ?? null;

  let tierProgress = 100;
  let nextTierLabel = 'Max Tier Reached';
  let nextTierAmountNeeded = 0;

  if (next) {
    const rangeSize = next.minPaise - current.minPaise;
    const progressInTier = totalSpentPaise - current.minPaise;
    tierProgress = Math.min(100, Math.floor((progressInTier / rangeSize) * 100));
    nextTierLabel = next.label;
    nextTierAmountNeeded = Math.max(0, next.minPaise - totalSpentPaise);
  }

  return { tier: current, nextTierLabel, tierProgress, nextTierAmountNeeded };
}

function getLevel(xp: number) {
  let level = 1;
  for (let i = XP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  level = Math.min(level, 10);
  const xpForCurrentLevel = XP_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const xpForNextLevel = XP_LEVEL_THRESHOLDS[level] ?? 15000;
  const xpToNextLevel = Math.max(0, xpForNextLevel - xp);
  const levelProgress =
    level === 10
      ? 100
      : Math.floor(((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100);
  return { level, xpToNextLevel, levelProgress };
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Sync user stats from DB (called internally + on-demand) ─────────────────

async function computeAndSaveStats(userId: string) {
  const [paymentsAgg, couponCount, subscription, user] = await Promise.all([
    prisma.payment.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: { amount: true, credits: true },
      _count: { id: true },
    }),
    prisma.couponRedemption.count({ where: { userId } }),
    prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'AUTHENTICATED'] } },
    }),
    prisma.user.findUnique({
      where: { userId },
      select: { isPhoneVerified: true, createdAt: true },
    }),
  ]);

  const totalSpentPaise = paymentsAgg._sum.amount ?? 0;
  const totalPurchases = paymentsAgg._count.id ?? 0;
  const totalCreditsEarned = paymentsAgg._sum.credits ?? 0;

  // Recalculate XP from completion state (this makes it tamper-proof)
  let xp = 0;
  if (user?.isPhoneVerified) xp += 15;
  if (totalPurchases >= 1) xp += 50;
  if (totalPurchases >= 3) xp += 50;
  if (totalPurchases >= 5) xp += 50;
  if (totalPurchases >= 10) xp += 100;
  if (totalSpentPaise >= 50_000) xp += 75;
  if (totalSpentPaise >= 200_000) xp += 125;
  if (totalSpentPaise >= 500_000) xp += 250;
  if (subscription) xp += 100;
  if (couponCount >= 1) xp += 25;

  // Fetch existing gamification record for streak preservation
  const existing = await prisma.userGamification.findUnique({ where: { userId } });
  const streakXp = (existing?.loginStreak ?? 0) * 10;
  xp += streakXp;

  const { level } = getLevel(xp);

  const stats = await prisma.userGamification.upsert({
    where: { userId },
    create: {
      userId,
      totalSpentPaise,
      totalPurchases,
      totalCreditsEarned,
      xp,
      level,
      lastSyncedAt: new Date(),
    },
    update: {
      totalSpentPaise,
      totalPurchases,
      totalCreditsEarned,
      xp,
      level,
      lastSyncedAt: new Date(),
    },
  });

  // Auto-unlock achievements based on current stats
  const allAchievements = await prisma.achievement.findMany({ where: { isActive: true } });
  const existingUnlocked = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(existingUnlocked.map((u) => u.achievementId));
  const newlyUnlocked: string[] = [];

  for (const ach of allAchievements) {
    if (unlockedIds.has(ach.id)) continue;

    let shouldUnlock = false;
    switch (ach.thresholdType) {
      case 'purchase_count':
        shouldUnlock = totalPurchases >= ach.thresholdValue;
        break;
      case 'total_spent_paise':
        shouldUnlock = totalSpentPaise >= ach.thresholdValue;
        break;
      case 'login_streak':
        shouldUnlock = stats.loginStreak >= ach.thresholdValue;
        break;
      case 'phone_verified':
        shouldUnlock = user?.isPhoneVerified ?? false;
        break;
      case 'subscription_active':
        shouldUnlock = !!subscription;
        break;
      case 'coupon_count':
        shouldUnlock = couponCount >= ach.thresholdValue;
        break;
      case 'always':
        shouldUnlock = true;
        break;
    }

    if (shouldUnlock) {
      try {
        await prisma.userAchievement.create({ data: { userId, achievementId: ach.id } });
        newlyUnlocked.push(ach.achievementKey);
        // Award XP for achievement unlock
        await prisma.userGamification.update({
          where: { userId },
          data: { xp: { increment: ach.xpReward } },
        });
      } catch {
        // Unique constraint — already exists, skip
      }
    }
  }

  return { stats, newlyUnlocked };
}

// Cache key helper
const GAMIFICATION_CACHE_KEY = (userId: string) => `gamification:${userId}`;
const CACHE_TTL = 60; // 60 seconds

async function safeRedisGet(key: string) {
  try {
    return await redis.get(key);
  } catch (error) {
    logger.warn('Gamification cache read failed', { key, error });
    return null;
  }
}

async function safeRedisSetex(key: string, ttl: number, value: string) {
  try {
    await redis.setex(key, ttl, value);
  } catch (error) {
    logger.warn('Gamification cache write failed', { key, error });
  }
}

// ─── Controller Handlers ──────────────────────────────────────────────────────

export const getGamificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Try cache
    const cached = await safeRedisGet(GAMIFICATION_CACHE_KEY(userId));
    if (cached) {
      if (typeof cached === 'string') {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      if (typeof cached === 'object') {
        return res.json({ success: true, data: cached });
      }
    }

    // Sync stats fresh
    const { stats, newlyUnlocked } = await computeAndSaveStats(userId);

    // Fetch all achievements with unlock status
    const [allAchievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { rarity: 'asc' }],
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
    ]);

    const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]));

    const achievements = allAchievements.map((ach) => {
      const unlocked = unlockedMap.has(ach.id);

      // Compute progress percentage toward this achievement
      let progress = 0;
      if (unlocked) {
        progress = 100;
      } else {
        switch (ach.thresholdType) {
          case 'purchase_count':
            progress = Math.min(100, Math.floor((stats.totalPurchases / ach.thresholdValue) * 100));
            break;
          case 'total_spent_paise':
            progress = Math.min(
              100,
              Math.floor((stats.totalSpentPaise / ach.thresholdValue) * 100),
            );
            break;
          case 'login_streak':
            progress = Math.min(100, Math.floor((stats.loginStreak / ach.thresholdValue) * 100));
            break;
          case 'phone_verified':
          case 'subscription_active':
          case 'always':
            progress = unlocked ? 100 : 0;
            break;
          case 'coupon_count':
            // we don't expose couponCount here; set to 0 or 100
            progress = unlocked ? 100 : 0;
            break;
        }
      }

      // Human-readable "what's needed" nudge text
      let nudgeText = '';
      if (!unlocked) {
        switch (ach.thresholdType) {
          case 'purchase_count': {
            const remaining = Math.max(0, ach.thresholdValue - stats.totalPurchases);
            nudgeText = `Make ${remaining} more purchase${remaining !== 1 ? 's' : ''}`;
            break;
          }
          case 'total_spent_paise': {
            const remaining = Math.max(0, ach.thresholdValue - stats.totalSpentPaise);
            nudgeText = `Spend ₹${Math.ceil(remaining / 100)} more`;
            break;
          }
          case 'login_streak': {
            const remaining = Math.max(0, ach.thresholdValue - stats.loginStreak);
            nudgeText = `${remaining} more day${remaining !== 1 ? 's' : ''} of login streak`;
            break;
          }
          case 'phone_verified':
            nudgeText = 'Verify your phone number';
            break;
          case 'subscription_active':
            nudgeText = 'Activate a subscription plan';
            break;
          case 'coupon_count':
            nudgeText = 'Redeem a coupon code';
            break;
          case 'always':
            nudgeText = '';
            break;
        }
      }

      return {
        id: ach.id,
        achievementKey: ach.achievementKey,
        title: ach.title,
        description: ach.description,
        howToReach: ach.howToReach,
        icon: ach.icon,
        rarity: ach.rarity,
        category: ach.category,
        xpReward: ach.xpReward,
        unlocked,
        unlockedAt: unlockedMap.get(ach.id) ?? null,
        progress,
        nudgeText,
      };
    });

    const tierInfo = getTierInfo(stats.totalSpentPaise);
    const levelInfo = getLevel(stats.xp);

    // Pick nearest locked achievement for the "you're so close!" card
    const lockedWithProgress = achievements
      .filter((a) => !a.unlocked && a.progress > 0 && a.progress < 100)
      .sort((a, b) => b.progress - a.progress);
    const closestLocked = lockedWithProgress[0] ?? null;

    const result = {
      loginStreak: stats.loginStreak,
      longestStreak: stats.longestStreak,
      level: levelInfo.level,
      xp: stats.xp,
      xpToNextLevel: levelInfo.xpToNextLevel,
      levelProgress: levelInfo.levelProgress,
      totalSpentPaise: stats.totalSpentPaise,
      totalPurchases: stats.totalPurchases,
      totalCreditsEarned: stats.totalCreditsEarned,
      tier: tierInfo.tier,
      tierProgress: tierInfo.tierProgress,
      nextTierLabel: tierInfo.nextTierLabel,
      nextTierAmountNeeded: tierInfo.nextTierAmountNeeded,
      checkedInToday: stats.checkedInToday,
      achievements,
      newlyUnlocked,
      closestLocked,
    };

    await safeRedisSetex(GAMIFICATION_CACHE_KEY(userId), CACHE_TTL, JSON.stringify(result));

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('getGamificationStatus error', {
      userId: (req as Request & { userId?: string }).userId,
      error:
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : error,
    });
    return res.status(500).json({ success: false, message: 'Failed to fetch gamification status' });
  }
};

export const dailyCheckin = async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const today = todayISODate();

    const gam = await prisma.userGamification.findUnique({ where: { userId } });

    if (gam?.lastLoginDate === today) {
      // Already checked in today — idempotent
      return res.json({
        success: true,
        message: 'Already checked in today',
        xpEarned: 0,
        streak: gam.loginStreak,
      });
    }

    // Determine if streak continues
    let newStreak = 1;
    if (gam?.lastLoginDate) {
      const lastDate = new Date(gam.lastLoginDate);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak = (gam.loginStreak ?? 0) + 1;
      } else {
        newStreak = 1; // streak broken
      }
    }

    const CHECK_IN_XP = 10;

    const updated = await prisma.userGamification.upsert({
      where: { userId },
      create: {
        userId,
        loginStreak: newStreak,
        longestStreak: newStreak,
        lastLoginDate: today,
        checkedInToday: true,
        xp: CHECK_IN_XP,
        level: 1,
      },
      update: {
        loginStreak: newStreak,
        longestStreak: { set: Math.max(gam?.longestStreak ?? 0, newStreak) },
        lastLoginDate: today,
        checkedInToday: true,
        xp: { increment: CHECK_IN_XP },
      },
    });

    // Auto-unlock streak achievements
    const { newlyUnlocked } = await computeAndSaveStats(userId);

    // Bust cache
    await redis.del(GAMIFICATION_CACHE_KEY(userId));

    return res.json({
      success: true,
      message: `Day ${newStreak} streak! +${CHECK_IN_XP} XP`,
      xpEarned: CHECK_IN_XP,
      streak: updated.loginStreak,
      newlyUnlocked,
    });
  } catch (error) {
    logger.error('dailyCheckin error', { error });
    return res.status(500).json({ success: false, message: 'Failed to record daily check-in' });
  }
};

export const syncGamification = async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await computeAndSaveStats(userId);
    await redis.del(GAMIFICATION_CACHE_KEY(userId));

    return res.json({ success: true, message: 'Gamification stats synced' });
  } catch (error) {
    logger.error('syncGamification error', { error });
    return res.status(500).json({ success: false, message: 'Sync failed' });
  }
};
