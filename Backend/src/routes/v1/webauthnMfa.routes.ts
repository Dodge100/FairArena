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
 * @openapi
 * /api/v1/mfa/webauthn/register/options:
 *   post:
 *     summary: Generate WebAuthn registration options
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
router.post('/register/options', protectRoute, requireSettingsVerification, registrationLimiter, getRegistrationOptions);

/**
 * @openapi
 * /api/v1/mfa/webauthn/register/verify:
 *   post:
 *     summary: Verify WebAuthn registration and save security key
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
router.post('/register/verify', protectRoute, requireSettingsVerification, registrationLimiter, verifyRegistration);

// Authentication Routes (Can be called with temp MFA token - no settings verification needed)

/**
 * @openapi
 * /api/v1/mfa/webauthn/authenticate/options:
 *   post:
 *     summary: Generate WebAuthn authentication options for MFA
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
 * @openapi
 * /api/v1/mfa/webauthn/authenticate/verify:
 *   post:
 *     summary: Verify WebAuthn assertion for MFA login
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
 * @openapi
 * /api/v1/mfa/webauthn/devices:
 *   get:
 *     summary: List registered security keys
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
 * @openapi
 * /api/v1/mfa/webauthn/devices/{id}:
 *   delete:
 *     summary: Delete a security key
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
 * @openapi
 * /api/v1/mfa/webauthn/devices/{id}/rename:
 *   patch:
 *     summary: Rename a security key
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
