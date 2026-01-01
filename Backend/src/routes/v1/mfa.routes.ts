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
 * @openapi
 * /api/v1/mfa/status:
 *   get:
 *     summary: Get MFA status
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA status
 */
router.get('/status', getMFAStatus);

/**
 * @openapi
 * /api/v1/mfa/setup:
 *   post:
 *     summary: Start MFA setup
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code and backup codes
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
 * @openapi
 * /api/v1/mfa/verify-setup:
 *   post:
 *     summary: Complete MFA setup
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
 *         description: MFA enabled
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
 * @openapi
 * /api/v1/mfa/verify:
 *   post:
 *     summary: Verify MFA code
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
 *         description: Verification successful
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
 * @openapi
 * /api/v1/mfa/disable:
 *   post:
 *     summary: Disable MFA
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
 *         description: MFA disabled
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
 * @openapi
 * /api/v1/mfa/regenerate-backup:
 *   post:
 *     summary: Regenerate backup codes
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
 *         description: New backup codes
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
