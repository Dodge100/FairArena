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
import { inviteToPlatform } from '../../controllers/v1/platformInviteController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/platform/invite:
 *   post:
 *     summary: Invite user to platform
 *     description: Send an invitation email to join the FairArena platform
 *     tags: [Platform Invite]
 *     security:
 *       - ClerkAuth: []
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
 *                 description: Email address of the person to invite
 *               message:
 *                 type: string
 *                 description: Personal message to include in the invitation
 *                 maxLength: 500
 *           examples:
 *             inviteUser:
 *               value:
 *                 email: "friend@example.com"
 *                 message: "I think you'd love FairArena! Join me on the platform."
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation sent successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/invite', verifyRecaptcha, protectRoute, inviteToPlatform);

export default router;
