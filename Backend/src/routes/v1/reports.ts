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
import { CreateReport, GetUserReports } from '../../controllers/v1/reportsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: Get user's reports
 *     description: Retrieve all reports submitted by the authenticated user
 *     tags: [Reports]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Create a report
 *     description: Submit a report for inappropriate content or behavior
 *     tags: [Reports]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportedId
 *               - reportType
 *               - reason
 *             properties:
 *               reportedId:
 *                 type: string
 *                 description: ID of the entity being reported
 *               reportType:
 *                 type: string
 *                 enum: [profile, organization, project, comment]
 *               reason:
 *                 type: string
 *                 description: Reason for the report
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *           examples:
 *             reportProfile:
 *               value:
 *                 reportedId: "550e8400-e29b-41d4-a716-446655440000"
 *                 reportType: "profile"
 *                 reason: "Inappropriate content"
 *                 description: "This profile contains offensive material"
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', protectRoute, requireSettingsVerification, GetUserReports);
router.post('/', protectRoute, CreateReport);

export default router;
