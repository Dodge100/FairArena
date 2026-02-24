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
import logger from '../../utils/logger.js';

/**
 * GET /api/v1/onboarding/status
 * Returns current onboarding status and version
 */
export async function getOnboardingStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        onboardingStatus: true,
        onboardingVersion: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        status: user.onboardingStatus,
        version: user.onboardingVersion,
        completedAt: user.onboardingCompletedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching onboarding status', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch onboarding status',
      },
    });
  }
}

/**
 * PATCH /api/v1/onboarding/progress
 * Track step completion for analytics
 */
export async function trackOnboardingProgress(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { step } = req.body;

    if (typeof step !== 'number' || step < 1 || step > 5) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STEP',
          message: 'Step must be a number between 1 and 5',
        },
      });
      return;
    }

    logger.info('Onboarding progress tracked', { userId, step });

    res.json({
      success: true,
      data: {
        step,
        tracked: true,
      },
    });
  } catch (error) {
    logger.error('Error tracking onboarding progress', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to track progress',
      },
    });
  }
}

/**
 * PATCH /api/v1/onboarding/complete
 * Mark onboarding as completed - idempotent operation
 */
export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        onboardingStatus: true,
        onboardingVersion: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Idempotent: if already completed, return success
    if (user.onboardingStatus === 'COMPLETED') {
      logger.info('Onboarding already completed', { userId });
      res.json({
        success: true,
        data: {
          status: 'COMPLETED',
          message: 'Onboarding already completed',
        },
      });
      return;
    }

    // Only PENDING status can transition to COMPLETED
    if (user.onboardingStatus !== 'PENDING') {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot complete onboarding from ${user.onboardingStatus} state`,
        },
      });
      return;
    }

    // Atomic state transition
    const updated = await prisma.user.update({
      where: { userId },
      data: {
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
      },
      select: {
        onboardingStatus: true,
        onboardingCompletedAt: true,
      },
    });

    logger.info('Onboarding completed', { userId });

    res.json({
      success: true,
      data: {
        status: updated.onboardingStatus,
        completedAt: updated.onboardingCompletedAt,
      },
    });
  } catch (error) {
    logger.error('Error completing onboarding', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete onboarding',
      },
    });
  }
}

/**
 * PATCH /api/v1/onboarding/skip
 * Mark onboarding as skipped - idempotent operation
 */
export async function skipOnboarding(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        onboardingStatus: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Idempotent: if already skipped, return success
    if (user.onboardingStatus === 'SKIPPED') {
      logger.info('Onboarding already skipped', { userId });
      res.json({
        success: true,
        data: {
          status: 'SKIPPED',
          message: 'Onboarding already skipped',
        },
      });
      return;
    }

    // Only PENDING status can transition to SKIPPED
    if (user.onboardingStatus !== 'PENDING') {
      res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot skip onboarding from ${user.onboardingStatus} state`,
        },
      });
      return;
    }

    // Atomic state transition
    const updated = await prisma.user.update({
      where: { userId },
      data: {
        onboardingStatus: 'SKIPPED',
      },
      select: {
        onboardingStatus: true,
      },
    });

    logger.info('Onboarding skipped', { userId });

    res.json({
      success: true,
      data: {
        status: updated.onboardingStatus,
      },
    });
  } catch (error) {
    logger.error('Error skipping onboarding', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to skip onboarding',
      },
    });
  }
}
