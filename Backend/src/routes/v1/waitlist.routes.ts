import { Router } from 'express';
import {
  checkWaitlistStatus,
  getWaitlistStats,
  joinWaitlist,
} from '../../controllers/v1/waitlistController.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/v1/waitlist:
 *   post:
 *     summary: Join the waitlist
 *     tags: [Waitlist]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               source:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully joined waitlist
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limited
 */
router.post(
  '/',
  createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour per IP
    message: 'Too many waitlist requests. Please try again later.',
  }),
  verifyRecaptcha,
  joinWaitlist,
);

/**
 * @openapi
 * /api/v1/waitlist/status/{email}:
 *   get:
 *     summary: Check waitlist status
 *     tags: [Waitlist]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Waitlist status
 *       404:
 *         description: Email not found
 */
router.get(
  '/status/:email',
  createAuthRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute per IP
    message: 'Too many status checks. Please try again later.',
  }),
  checkWaitlistStatus,
);

/**
 * @openapi
 * /api/v1/waitlist/stats:
 *   get:
 *     summary: Get waitlist statistics
 *     tags: [Waitlist]
 *     responses:
 *       200:
 *         description: Waitlist stats
 */
router.get('/stats', getWaitlistStats);

export default router;
