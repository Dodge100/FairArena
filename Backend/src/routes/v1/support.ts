import { Router } from 'express';
import { SupportController } from '../../controllers/v1/supportController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/support:
 *   get:
 *     summary: Get user's support tickets
 *     description: Retrieve all support tickets submitted by the authenticated user
 *     tags: [Support]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Support tickets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 supportTickets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', protectRoute, SupportController.getUserSupportTickets);

/**
 * @swagger
 * /api/v1/support:
 *   post:
 *     summary: Create a support request
 *     description: Submit a new support request. Rate limited to 5 requests/hour for anonymous users, 10 for authenticated users.
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *                 description: The subject of the support request
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 description: The detailed message of the support request
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address (required for non-authenticated users, optional for authenticated users)
 *     responses:
 *       201:
 *         description: Support request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     message:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/',
  SupportController.getRateLimitMiddleware(),
  SupportController.createSupportRequest,
);

export default router;
