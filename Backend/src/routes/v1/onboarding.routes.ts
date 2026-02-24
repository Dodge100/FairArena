import express from 'express';
import {
  completeOnboarding,
  getOnboardingStatus,
  skipOnboarding,
  trackOnboardingProgress,
} from '../../controllers/v1/onboardingController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/onboarding/status:
 *   get:
 *     summary: Get user's onboarding status
 *     description: Check if user has completed or skipped the onboarding process.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/status', protectRoute, getOnboardingStatus);

/**
 * @swagger
 * /api/v1/onboarding/progress:
 *   patch:
 *     summary: Track onboarding progress
 *     description: Update user's progress through the onboarding steps.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               step:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Progress updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/progress', protectRoute, trackOnboardingProgress);

/**
 * @swagger
 * /api/v1/onboarding/complete:
 *   patch:
 *     summary: Complete onboarding
 *     description: Mark the onboarding process as complete for the user.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/complete', protectRoute, completeOnboarding);

/**
 * @swagger
 * /api/v1/onboarding/skip:
 *   patch:
 *     summary: Skip onboarding
 *     description: Mark the onboarding process as skipped for the user.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding skipped successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/skip', protectRoute, skipOnboarding);

export default router;
