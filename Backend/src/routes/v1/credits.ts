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
  checkFreeCreditsEligibility,
  claimFreeCredits,
  getCreditBalance,
  getCreditHistory,
  sendSmsOtp,
  sendVoiceOtp,
  verifySmsOtp,
  verifyVoiceOtp,
} from '../../controllers/v1/creditsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/credits/balance:
 *   get:
 *     summary: Get credit balance
 *     description: Get the current credit balance for the authenticated user
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Credit balance retrieved successfully
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
 *                     balance:
 *                       type: integer
 *                     userId:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/balance', protectRoute, getCreditBalance);

/**
 * @swagger
 * /api/v1/credits/history:
 *   get:
 *     summary: Get credit transaction history
 *     description: Get paginated credit transaction history for the authenticated user
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transactions to skip
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PURCHASE, REFUND, BONUS, DEDUCTION, ADJUSTMENT, EXPIRY, TRANSFER_IN, TRANSFER_OUT]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Credit history retrieved successfully
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/history', protectRoute, getCreditHistory);

/**
 * @swagger
 * /api/v1/credits/claim-free:
 *   post:
 *     summary: Claim free credits for new users
 *     description: Claim 200 free credits for users who signed up within the last 30 days and haven't claimed yet (requires CAPTCHA)
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Free credits claimed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     creditsAdded:
 *                       type: integer
 *                     newBalance:
 *                       type: integer
 *                     transactionId:
 *                       type: string
 *       400:
 *         description: Free credits already claimed or not eligible
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/claim-free', protectRoute, verifyRecaptcha, claimFreeCredits);

/**
 * @swagger
 * /api/v1/credits/check-eligibility:
 *   get:
 *     summary: Check if user is eligible for free credits
 *     description: Check if the authenticated user can claim free credits
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Eligibility check completed
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
 *                     canClaimFreeCredits:
 *                       type: boolean
 *                     hasClaimedFreeCredits:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/check-eligibility', protectRoute, checkFreeCreditsEligibility);

/**
 * @swagger
 * /api/v1/credits/send-sms-otp:
 *   post:
 *     summary: Send SMS OTP for credits verification
 *     description: Send OTP to user's phone number for credits claim verification (requires CAPTCHA)
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Phone number not found
 *       429:
 *         description: Rate limit exceeded
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-sms-otp', protectRoute, verifyRecaptcha, sendSmsOtp);

/**
 * @swagger
 * /api/v1/credits/verify-sms-otp:
 *   post:
 *     summary: Verify SMS OTP for credits claim
 *     description: Verify the OTP sent to user's phone for credits claim
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit OTP
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-sms-otp', protectRoute, verifyRecaptcha, verifySmsOtp);

/**
 * @swagger
 * /api/v1/credits/send-voice-otp:
 *   post:
 *     summary: Send voice call OTP for credits verification
 *     description: Send OTP via voice call to user's phone number for credits claim verification (requires CAPTCHA)
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Voice OTP sent successfully
 *       400:
 *         description: Phone number not found
 *       429:
 *         description: Rate limit exceeded
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-voice-otp', protectRoute, verifyRecaptcha, sendVoiceOtp);

/**
 * @swagger
 * /api/v1/credits/verify-voice-otp:
 *   post:
 *     summary: Verify voice call OTP for credits claim
 *     description: Verify the OTP received via voice call for credits claim
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit OTP
 *     responses:
 *       200:
 *         description: Voice OTP verified successfully
 *       400:
 *         description: Invalid OTP
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-voice-otp', protectRoute, verifyRecaptcha, verifyVoiceOtp);

export default router;
