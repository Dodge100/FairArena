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
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis } from '../../config/redis.js';
import logger from '../../utils/logger.js';

const PLANS_CACHE_KEY = 'pricing:plans:all';
const PLAN_CACHE_PREFIX = 'pricing:plan:';
const CACHE_TTL = 86400; // 1 day in seconds

// Get all active plans
export const getAllPlans = async (req: Request, res: Response) => {
  try {
    // Try to get from Redis cache first
    const cachedPlans = await redis.get(PLANS_CACHE_KEY);
    if (cachedPlans) {
      logger.info('Plans fetched from cache');
      let plansData;
      if (typeof cachedPlans === 'string') {
        plansData = JSON.parse(cachedPlans);
      } else {
        // If Redis returns an object (auto-parsed), use it directly
        plansData = cachedPlans;
      }
      return res.status(200).json({
        success: true,
        plans: plansData,
        cached: true,
      });
    }

    // If not in cache, fetch from database
    const readOnlyPrisma = await getReadOnlyPrisma();
    const plans = await readOnlyPrisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ amount: 'asc' }],
      select: {
        id: true,
        planId: true,
        name: true,
        amount: true,
        currency: true,
        credits: true,
        description: true,
        features: true,
        isActive: true,
      },
    });

    // Cache the result for 1 day
    await redis.set(PLANS_CACHE_KEY, JSON.stringify(plans), { ex: CACHE_TTL });

    logger.info('Plans fetched from database and cached', { count: plans.length });

    return res.status(200).json({
      success: true,
      plans,
      cached: false,
    });
  } catch (error) {
    logger.error('Failed to fetch plans', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
    });
  }
};

// Get plan by ID
export const getPlanByPlanId = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required',
      });
    }

    // Try to get from Redis cache first
    const cacheKey = `${PLAN_CACHE_PREFIX}${planId}`;
    const cachedPlan = await redis.get(cacheKey);
    if (cachedPlan) {
      logger.info('Plan fetched from cache', { planId });
      let planData;
      if (typeof cachedPlan === 'string') {
        planData = JSON.parse(cachedPlan);
      } else {
        // If Redis returns an object (auto-parsed), use it directly
        planData = cachedPlan;
      }
      return res.status(200).json({
        success: true,
        plan: planData,
        cached: true,
      });
    }

    // If not in cache, fetch from database
    const readOnlyPrisma = await getReadOnlyPrisma();
    const plan = await readOnlyPrisma.plan.findUnique({
      where: { planId: planId as string, isActive: true },
      select: {
        id: true,
        planId: true,
        name: true,
        amount: true,
        currency: true,
        credits: true,
        description: true,
        features: true,
        isActive: true,
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    // Cache the result for 1 day
    await redis.set(cacheKey, JSON.stringify(plan), { ex: CACHE_TTL });

    logger.info('Plan fetched from database and cached', { planId });

    return res.status(200).json({
      success: true,
      plan,
      cached: false,
    });
  } catch (error) {
    logger.error('Failed to fetch plan', {
      error: error instanceof Error ? error.message : String(error),
      planId: req.params.planId,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch plan',
    });
  }
};
