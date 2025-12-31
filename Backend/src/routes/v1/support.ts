import { Router } from 'express';
import * as UploadController from '../../controllers/v1/support/uploadController.js';
import { SupportController } from '../../controllers/v1/supportController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

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
  verifyRecaptcha,
  SupportController.getRateLimitMiddleware(),
  SupportController.createSupportRequest,
);

/**
 * @swagger
 * /api/v1/support/upload/sas-token:
 *   post:
 *     summary: Generate SAS token for file upload
 *     description: Generate a time-limited SAS token for direct upload to Azure Blob Storage
 *     tags: [Support]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - fileSize
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Name of the file to upload
 *               fileSize:
 *                 type: number
 *                 description: Size of the file in bytes (max 100MB)
 *               contentType:
 *                 type: string
 *                 description: MIME type of the file
 *     responses:
 *       200:
 *         description: SAS token generated successfully
 *       400:
 *         description: Invalid request or file type not allowed
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/upload/sas-token', protectRoute, UploadController.generateUploadSasToken);

/**
 * @swagger
 * /api/v1/support/upload/confirm:
 *   post:
 *     summary: Confirm file upload completion
 *     description: Confirm that a file has been successfully uploaded to Azure Blob Storage
 *     tags: [Support]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blobName
 *             properties:
 *               blobName:
 *                 type: string
 *                 description: Name of the uploaded blob
 *               supportTicketId:
 *                 type: string
 *                 description: Optional support ticket ID to associate with upload
 *     responses:
 *       200:
 *         description: Upload confirmed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Unauthorized access to blob
 *       500:
 *         description: Server error
 */
router.post('/upload/confirm', protectRoute, UploadController.confirmUpload);

export default router;
