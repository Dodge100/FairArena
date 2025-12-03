import { Router } from 'express';
import {
  checkStatus,
  exportUserData,
  getLogs,
  sendOtp,
  verifyOtp,
} from '../../controllers/v1/accountSettingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../../middleware/captcha.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/account-settings/send-otp:
 *   post:
 *     summary: Send OTP for account settings
 *     description: Send a one-time password to user's email for account verification (requires CAPTCHA)
 *     tags: [Account Settings]
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
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-otp', protectRoute, verifyRecaptcha, sendOtp);

/**
 * @swagger
 * /api/v1/account-settings/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     description: Verify the OTP sent to user's email (requires CAPTCHA)
 *     tags: [Account Settings]
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
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit OTP
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid OTP
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-otp', protectRoute, verifyRecaptcha, verifyOtp);

/**
 * @swagger
 * /api/v1/account-settings/status:
 *   get:
 *     summary: Check verification status
 *     description: Check the account verification status
 *     tags: [Account Settings]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 lastVerified:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/status', protectRoute, checkStatus);

/**
 * @swagger
 * /api/v1/account-settings/logs:
 *   get:
 *     summary: Get account logs
 *     description: Retrieve account activity logs for the authenticated user
 *     tags: [Account Settings]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       action:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       metadata:
 *                         type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/logs', protectRoute, getLogs);

/**
 * @swagger
 * /api/v1/account-settings/export-data:
 *   post:
 *     summary: Export user data
 *     description: Request a full export of user data (GDPR compliance)
 *     tags: [Account Settings]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Export initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Data export initiated. You will receive an email when ready."
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/export-data', protectRoute, exportUserData);

export default router;
