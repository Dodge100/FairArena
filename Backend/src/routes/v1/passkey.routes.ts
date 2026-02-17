import { Router } from 'express';
import {
  deletePasskey,
  getAuthenticationOptions,
  getRegistrationOptions,
  listPasskeys,
  renamePasskey,
  verifyAuthentication,
  verifyRegistration,
} from '../../controllers/v1/passkeyController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';

const router = Router();

// Rate limiters
const registrationLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per 15 minutes
  message: 'Too many passkey registration attempts. Please try again later.',
});

const authenticationLimiter = createAuthRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 authentication attempts per minute
  message: 'Too many passkey authentication attempts. Please try again later.',
});

// --- Registration Routes (authenticated) ---

/**
 * @openapi
 * /api/v1/passkeys/register/options:
 *   post:
 *     summary: Get passkey registration options
 *     description: Generate WebAuthn registration options for creating a new passkey
 *     tags: [Passkeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registration options generated
 *       401:
 *         description: Authentication required
 */
router.post('/register/options', registrationLimiter, protectRoute, getRegistrationOptions);

/**
 * @openapi
 * /api/v1/passkeys/register/verify:
 *   post:
 *     summary: Verify and save passkey registration
 *     description: Complete the passkey registration by verifying the credential
 *     tags: [Passkeys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response:
 *                 type: object
 *                 description: WebAuthn attestation response
 *               name:
 *                 type: string
 *                 description: Optional friendly name for the passkey
 *     responses:
 *       201:
 *         description: Passkey registered successfully
 *       400:
 *         description: Verification failed
 *       401:
 *         description: Authentication required
 */
router.post('/register/verify', registrationLimiter, protectRoute, verifyRegistration);

// --- Authentication Routes (public) ---

/**
 * @openapi
 * /api/v1/passkeys/login/options:
 *   post:
 *     summary: Get passkey authentication options
 *     description: Generate WebAuthn authentication options for signing in with a passkey
 *     tags: [Passkeys]
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Optional email to scope allowed credentials
 *     responses:
 *       200:
 *         description: Authentication options generated
 */
router.post('/login/options', authenticationLimiter, getAuthenticationOptions);

/**
 * @openapi
 * /api/v1/passkeys/login/verify:
 *   post:
 *     summary: Verify passkey authentication
 *     description: Complete sign-in by verifying the passkey assertion
 *     tags: [Passkeys]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response:
 *                 type: object
 *                 description: WebAuthn assertion response
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Authentication failed
 */
router.post('/login/verify', authenticationLimiter, verifyAuthentication);

// --- Management Routes (authenticated) ---

/**
 * @openapi
 * /api/v1/passkeys:
 *   get:
 *     summary: List user's passkeys
 *     description: Get all registered passkeys for the authenticated user
 *     tags: [Passkeys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of passkeys
 *       401:
 *         description: Authentication required
 */
router.get('/', protectRoute, listPasskeys);

/**
 * @openapi
 * /api/v1/passkeys/{id}:
 *   delete:
 *     summary: Delete a passkey
 *     description: Remove a registered passkey
 *     tags: [Passkeys]
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
 *         description: Passkey deleted
 *       404:
 *         description: Passkey not found
 */
router.delete('/:id', protectRoute, deletePasskey);

/**
 * @openapi
 * /api/v1/passkeys/{id}/rename:
 *   patch:
 *     summary: Rename a passkey
 *     description: Update the friendly name of a passkey
 *     tags: [Passkeys]
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Passkey renamed
 *       404:
 *         description: Passkey not found
 */
router.patch('/:id/rename', protectRoute, renamePasskey);

export default router;
