import { Router } from 'express';
import {
  checkStarStatus,
  getProfileStars,
  starProfile,
  unstarProfile,
} from '../../controllers/v1/starsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// Protected routes
router.post('/star', protectRoute, starProfile);
router.post('/unstar', protectRoute, unstarProfile);
router.get('/profile/:profileId/status', protectRoute, checkStarStatus);

// Public routes
router.get('/profile/:userId', getProfileStars);

export default router;
