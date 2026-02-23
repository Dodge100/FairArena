import { Router } from 'express';
import {
  dailyCheckin,
  getGamificationStatus,
  syncGamification,
} from '../../controllers/v1/gamificationController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/status', protectRoute, getGamificationStatus);
router.post('/daily-checkin', protectRoute, dailyCheckin);
router.post('/sync', protectRoute, syncGamification);

export default router;
