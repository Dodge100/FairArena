import { Router } from 'express';
import {
  dailyCheckin,
  getGamificationStatus,
  syncGamification,
} from '../../controllers/v1/gamificationController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/gamification/status:
 *   get:
 *     summary: Get user's gamification status
 *     description: Retrieve user's level, experience points, and current streaks.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Gamification status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/status', protectRoute, getGamificationStatus);

/**
 * @swagger
 * /api/v1/gamification/daily-checkin:
 *   post:
 *     summary: Perform daily check-in
 *     description: Check in to receive rewards and maintain streaks.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Checked in successfully
 *       400:
 *         description: Already checked in today
 *       401:
 *         description: Unauthorized
 */
router.post('/daily-checkin', protectRoute, dailyCheckin);

/**
 * @swagger
 * /api/v1/gamification/sync:
 *   post:
 *     summary: Sync gamification data
 *     description: Manually trigger a synchronization of gamification data.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Data synced successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/sync', protectRoute, syncGamification);

export default router;
