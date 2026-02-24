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
  deleteSecurityKey,
  getAuthenticationOptions,
  getRegistrationOptions,
  listSecurityKeys,
  renameSecurityKey,
  verifyAuthentication,
  verifyRegistration,
} from '../../controllers/v1/webauthnMfaController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';

const router = Router();

// Rate limiters
const registrationLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 registration attempts
  message: 'Too many registration attempts, please try again later',
});

const authLimiter = createAuthRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 auth attempts
  message: 'Too many authentication attempts, please try again later',
});

// Registration Routes (Authenticated users only, requires settings verification)

/**
 * @swagger
 * /api/v1/mfa/webauthn/register/options:
 *   post:
 *     summary: Generate WebAuthn registration options
 *     description: Initiate the process of registering a new security key or biometric credential.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registration options generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: WebAuthn creation options (challenge, rp, user, etc.)
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/register/options',
  protectRoute,
  requireSettingsVerification,
  registrationLimiter,
  getRegistrationOptions,
);

/**
 * @swagger
 * /api/v1/mfa/webauthn/register/verify:
 *   post:
 *     summary: Verify WebAuthn registration
 *     description: Finalize the registration of a new security key by verifying the credential response from the browser.
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
 *               - response
 *             properties:
 *               response:
 *                 type: object
 *                 description: WebAuthn registration response from browser
 *               name:
 *                 type: string
 *                 description: Friendly name for the security key
 *     responses:
 *       201:
 *         description: Security key registered successfully
 *       400:
 *         description: Verification failed or invalid request
 */
router.post(
  '/register/verify',
  protectRoute,
  requireSettingsVerification,
  registrationLimiter,
  verifyRegistration,
);

// Authentication Routes (Can be called with temp MFA token - no settings verification needed)

/**
 * @swagger
 * /api/v1/mfa/webauthn/authenticate/options:
 *   post:
 *     summary: Generate WebAuthn authentication options
 *     description: Initiate the login process using a previously registered security key.
 *     tags: [MFA]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tempToken:
 *                 type: string
 *                 description: Temporary MFA token if not using cookie
 *     responses:
 *       200:
 *         description: Authentication options generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: WebAuthn request options
 */
router.post('/authenticate/options', authLimiter, getAuthenticationOptions);

/**
 * @swagger
 * /api/v1/mfa/webauthn/authenticate/verify:
 *   post:
 *     summary: Verify WebAuthn authentication
 *     description: Complete the login process by verifying the authentication assertion from the browser.
 *     tags: [MFA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: object
 *                 description: WebAuthn authentication response from browser
 *               tempToken:
 *                 type: string
 *                 description: Temporary MFA token if not using cookie
 *     responses:
 *       200:
 *         description: Access granted, tokens issued
 *       400:
 *         description: Verification failed
 *       401:
 *         description: Session expired or invalid
 */
router.post('/authenticate/verify', authLimiter, verifyAuthentication);

// Management Routes (Authenticated users only, requires settings verification)

/**
 * @swagger
 * /api/v1/mfa/webauthn/devices:
 *   get:
 *     summary: List registered security keys
 *     description: Retrieve all security keys registered by the authenticated user.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of security keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       deviceType:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                       lastUsedAt:
 *                         type: string
 */
router.get('/devices', protectRoute, requireSettingsVerification, listSecurityKeys);

/**
 * @swagger
 * /api/v1/mfa/webauthn/devices/{id}:
 *   delete:
 *     summary: Delete a security key
 *     description: Unregister and delete a specific security key.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Security key removed
 *       404:
 *         description: Device not found
 */
router.delete('/devices/:id', protectRoute, requireSettingsVerification, deleteSecurityKey);

/**
 * @swagger
 * /api/v1/mfa/webauthn/devices/{id}/rename:
 *   patch:
 *     summary: Rename a security key
 *     description: Change the friendly name of a registered security key.
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device renamed
 *       400:
 *         description: Invalid name
 *       404:
 *         description: Device not found
 */
router.patch('/devices/:id/rename', protectRoute, requireSettingsVerification, renameSecurityKey);

export default router;
