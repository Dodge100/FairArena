import express from 'express';
import {
  completeOnboarding,
  getOnboardingStatus,
  skipOnboarding,
  trackOnboardingProgress,
} from '../../controllers/v1/onboardingController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/v1/onboarding/status
router.get('/status', protectRoute, getOnboardingStatus);

// PATCH /api/v1/onboarding/progress
router.patch('/progress', protectRoute, trackOnboardingProgress);

// PATCH /api/v1/onboarding/complete
router.patch('/complete', protectRoute, completeOnboarding);

// PATCH /api/v1/onboarding/skip
router.patch('/skip', protectRoute, skipOnboarding);

export default router;
