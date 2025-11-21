import { Router } from 'express';
import {
  getOwnProfile,
  getPublicProfile,
  updateProfile,
} from '../../controllers/v1/profileController.js';
import { getProfileViews, recordView } from '../../controllers/v1/profileViewController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// Public route - get public profile by userId
router.get('/public/:userId', getPublicProfile);

// Protected routes
router.get('/me', protectRoute, getOwnProfile);
router.put('/me', protectRoute, updateProfile);

// Profile view tracking
router.post('/:profileId/view', protectRoute, recordView);
router.get('/views', protectRoute, getProfileViews);

export default router;
