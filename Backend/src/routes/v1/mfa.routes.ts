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
  disableMFA,
  getMFAStatus,
  regenerateBackupCodes,
  startMFASetup,
  verifyMFA,
  verifyMFASetup,
} from '../../controllers/v1/mfaController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';
const router = Router();

// All MFA routes require authentication
router.use(protectRoute);

/**
 * @swagger
 * /api/v1/mfa/status:
 *   get:
 *     summary: Get MFA status
 *     description: Check if Multi-Factor Authentication is enabled and retrieve user's MFA settings.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA status retrieved successfully
 */
router.get('/status', getMFAStatus);

/**
 * @swagger
 * /api/v1/mfa/setup:
 *   post:
 *     summary: Start MFA setup
 *     description: Initialize the setup of Multi-Factor Authentication, returning a secret key and QR code.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA setup initiated with QR code and backup codes
 */
router.post(
  '/setup',
  createAuthRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many MFA setup attempts. Please try again later.',
  }),
  requireSettingsVerification,
  startMFASetup,
);

/**
 * @swagger
 * /api/v1/mfa/verify-setup:
 *   post:
 *     summary: Complete MFA setup
 *     description: Finalize the MFA setup process by verifying the initial code from the authenticator app.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 *       204:
 *         description: Verification successful
 */
router.post(
  '/verify-setup',
  createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many verification attempts. Please try again later.',
  }),
  verifyMFASetup,
);

/**
 * @swagger
 * /api/v1/mfa/verify:
 *   post:
 *     summary: Verify MFA code
 *     description: Verify an MFA code or backup code during the login or sensitive action process.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *               isBackupCode:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: MFA verification successful
 */
router.post(
  '/verify',
  createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many verification attempts. Please try again later.',
  }),
  verifyMFA,
);

/**
 * @swagger
 * /api/v1/mfa/disable:
 *   post:
 *     summary: Disable MFA
 *     description: Turn off Multi-Factor Authentication for the user's account (requires password and code verification).
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - code
 *             properties:
 *               password:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 */
router.post(
  '/disable',
  createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many disable attempts. Please try again later.',
  }),
  requireSettingsVerification,
  disableMFA,
);

/**
 * @swagger
 * /api/v1/mfa/regenerate-backup:
 *   post:
 *     summary: Regenerate backup codes
 *     description: Generate a new set of backup codes, invalidating any previous ones.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: New backup codes generated successfully
 */
router.post(
  '/regenerate-backup',
  createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many backup code regeneration attempts. Please try again later.',
  }),
  requireSettingsVerification,
  regenerateBackupCodes,
);

export default router;
