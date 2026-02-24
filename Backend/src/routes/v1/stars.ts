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
  checkStarStatus,
  getProfileStars,
  starProfile,
  unstarProfile,
} from '../../controllers/v1/starsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/stars/star:
 *   post:
 *     summary: Star a profile
 *     description: Add a star to a profile to show appreciation
 *     tags: [Stars]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *             properties:
 *               profileId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the profile to star
 *     responses:
 *       200:
 *         description: Profile starred successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/star', protectRoute, starProfile);

/**
 * @swagger
 * /api/v1/stars/unstar:
 *   post:
 *     summary: Unstar a profile
 *     description: Remove a star from a profile
 *     tags: [Stars]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileId
 *             properties:
 *               profileId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Profile unstarred successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/unstar', protectRoute, unstarProfile);

/**
 * @swagger
 * /api/v1/stars/profile/{profileId}/status:
 *   get:
 *     summary: Check star status
 *     description: Check if the authenticated user has starred a specific profile
 *     tags: [Stars]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProfileIdParam'
 *     responses:
 *       200:
 *         description: Star status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isStarred:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/profile/:profileId/status', protectRoute, checkStarStatus);

/**
 * @swagger
 * /api/v1/stars/profile/{userId}:
 *   get:
 *     summary: Get profile stars
 *     description: Get all users who have starred a specific profile (public endpoint)
 *     tags: [Stars]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Stars retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         $ref: '#/components/schemas/Profile'
 *                       starredAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/profile/:userId', getProfileStars);

export default router;
