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
 * @swagger
 * /api/v1/waitlist:
 *   post:
 *     summary: Join the waitlist
 *     description: Submit an email address to join the platform waitlist.
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
 * @swagger
 * /api/v1/waitlist/status/{email}:
 *   get:
 *     summary: Check waitlist status
 *     description: Check the current waitlist status for a specific email address.
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
 *         description: Waitlist status retrieved successfully
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
 * @swagger
 * /api/v1/waitlist/stats:
 *   get:
 *     summary: Get waitlist statistics
 *     description: Retrieve general statistics about the waitlist (e.g., total entries).
 *     tags: [Waitlist]
 *     responses:
 *       200:
 *         description: Waitlist stats retrieved successfully
 */
router.get('/stats', getWaitlistStats);

export default router;
