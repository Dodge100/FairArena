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
import { getFeedback, submitFeedback } from '../../controllers/v1/feedbackController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/feedback/{feedbackCode}:
 *   get:
 *     summary: Get feedback by code
 *     description: Retrieve feedback information by its unique code. Used for displaying the feedback form.
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - name: feedbackCode
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique feedback code
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     feedbackCode:
 *                       type: string
 *                     message:
 *                       type: string
 *                       nullable: true
 *                     rating:
 *                       type: integer
 *                       nullable: true
 *                       minimum: 1
 *                       maximum: 5
 *                     isUsed:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Feedback not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Feedback not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to retrieve feedback"
 */
router.get('/:feedbackCode', getFeedback);

/**
 * @swagger
 * /api/v1/feedback/{feedbackCode}:
 *   post:
 *     summary: Submit feedback
 *     description: Submit feedback for the given code. Can only be done once per feedback code.
 *     tags: [Feedback]
 *     security: []
 *     parameters:
 *       - name: feedbackCode
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique feedback code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional feedback message
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Optional rating from 1 to 5
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Feedback submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     feedbackCode:
 *                       type: string
 *                     message:
 *                       type: string
 *                       nullable: true
 *                     rating:
 *                       type: integer
 *                       nullable: true
 *                     isUsed:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Feedback not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Feedback not found"
 *       409:
 *         description: Feedback already submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Feedback already submitted"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to submit feedback"
 */
router.post('/:feedbackCode', submitFeedback);

export default router;
