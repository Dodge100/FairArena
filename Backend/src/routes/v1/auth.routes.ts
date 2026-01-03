import { Router } from 'express';
import {
    changePassword,
    checkMfaSession,
    forgotPassword,
    getCurrentUser,
    getMfaPreferences,
    getRecentActivity,
    invalidateMfaSession,
    listSessions,
    login,
    logout,
    logoutAll,
    refreshAccessToken,
    register,
    resendVerificationEmail,
    resetPassword,
    revokeSession,
    sendEmailOtp,
    sendNotificationOtp,
    updateMfaPreferences,
    verifyEmail,
    verifyLoginMFA,
    verifyMfaOtp
} from '../../controllers/v1/authController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

const router = Router();

// Rate limiters for different endpoints
const registerLimiter = createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: 'Too many registration attempts. Please try again later.',
});

const loginLimiter = createAuthRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 login attempts per minute per IP
    message: 'Too many login attempts. Please try again later.',
});

const passwordResetLimiter = createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per hour per email
    message: 'Too many password reset attempts. Please try again later.',
});

const refreshLimiter = createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 60, // 60 refresh requests per hour
    message: 'Too many refresh attempts.',
});

const resendVerificationLimiter = createAuthRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 resend attempts per hour
    message: 'Too many verification email requests. Please try again later.',
});

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/register', registerLimiter, verifyRecaptcha, register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Account locked
 */
router.post('/login', loginLimiter, verifyRecaptcha, login);

/**
 * @swagger
 * /api/v1/auth/verify-mfa:
 *   post:
 *     summary: Verify MFA during login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, tempToken]
 *             properties:
 *               code:
 *                 type: string
 *               tempToken:
 *                 type: string
 *               isBackupCode:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid code
 *       401:
 *         description: Invalid session
 */
/**
 * @swagger
 * /api/v1/auth/verify-mfa:
 *   post:
 *     summary: Verify MFA code during login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, tempToken]
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 8
 *                 description: MFA code or backup code
 *               isBackupCode:
 *                 type: boolean
 *                 description: Whether the code is a backup code
 *               tempToken:
 *                 type: string
 *                 description: Temporary token from MFA-required login
 *     responses:
 *       200:
 *         description: MFA verification successful
 *       400:
 *         description: Invalid code or validation error
 *       401:
 *         description: Invalid or expired token
 *       429:
 *         description: Too many failed attempts
 */
router.post('/verify-mfa', loginLimiter, verifyRecaptcha, verifyLoginMFA);

/**
 * @swagger
 * /api/v1/auth/check-mfa-session:
 *   get:
 *     summary: Check MFA session status
 *     tags: [Authentication]
 *     description: Check if there's an active MFA session and retrieve UX state (HTTP-only cookie based)
 *     security: []
 *     responses:
 *       200:
 *         description: MFA session status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 mfaActive:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mfaCode:
 *                       type: string
 *                     isBackupCode:
 *                       type: boolean
 *                     attempts:
 *                       type: number
 *       401:
 *         description: Session security validation failed
 */
router.get('/check-mfa-session', checkMfaSession);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', refreshLimiter, refreshAccessToken);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout current session
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 */
router.post('/logout-all', protectRoute, logoutAll);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authenticated
 */
router.get('/me', protectRoute, getCurrentUser);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent (if account exists)
 */
router.post('/forgot-password', passwordResetLimiter, verifyRecaptcha, forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', passwordResetLimiter, verifyRecaptcha, resetPassword);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent (if account exists and unverified)
 */
router.post('/resend-verification', resendVerificationLimiter, verifyRecaptcha, resendVerificationEmail);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password (authenticated)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Current password incorrect
 */
router.post('/change-password', protectRoute, changePassword);

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: List user sessions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions', protectRoute, requireSettingsVerification, listSessions);

/**
 * @swagger
 * /api/v1/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', protectRoute, requireSettingsVerification, revokeSession);

/**
 * @swagger
 * /api/v1/auth/recent-activity:
 *   get:
 *     summary: Get recent security activity
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of recent activity logs
 */
router.get('/recent-activity', protectRoute, requireSettingsVerification, getRecentActivity);

/**
 * @swagger
 * /api/v1/auth/mfa/check-session:
 *   get:
 *     summary: Check if MFA session is active
 *     tags: [Authentication, MFA]
 *     security: []
 *     responses:
 *       200:
 *         description: MFA session status
 */
router.get('/mfa/check-session', checkMfaSession);

/**
 * @swagger
 * /api/v1/auth/mfa/invalidate:
 *   post:
 *     summary: Invalidate MFA session (back to sign in)
 *     tags: [Authentication, MFA]
 *     security: []
 *     responses:
 *       200:
 *         description: MFA session invalidated
 */
router.post('/mfa/invalidate', loginLimiter, invalidateMfaSession);

/**
 * @swagger
 * /api/v1/auth/mfa/send-email-otp:
 *   post:
 *     summary: Send OTP via email for MFA verification
 *     tags: [Authentication, MFA]
 *     security: []
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       401:
 *         description: No active MFA session
 *       429:
 *         description: Too many OTP requests
 */
router.post('/mfa/send-email-otp', loginLimiter, sendEmailOtp);

/**
 * @swagger
 * /api/v1/auth/mfa/send-notification-otp:
 *   post:
 *     summary: Send OTP via in-app notification for MFA verification
 *     tags: [Authentication, MFA]
 *     security: []
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       401:
 *         description: No active MFA session
 *       429:
 *         description: Too many OTP requests
 */
router.post('/mfa/send-notification-otp', loginLimiter, sendNotificationOtp);

/**
 * @swagger
 * /api/v1/auth/mfa/verify-otp:
 *   post:
 *     summary: Verify OTP from email or notification
 *     tags: [Authentication, MFA]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *               method:
 *                 type: string
 *                 enum: [email, notification]
 *     responses:
 *       200:
 *         description: Verification successful
 *       401:
 *         description: Invalid OTP
 */
router.post('/mfa/verify-otp', loginLimiter, verifyRecaptcha, verifyMfaOtp);

// OAuth Routes
import {
    getDiscordAuthUrl,
    getGithubAuthUrl,
    getGitLabAuthUrl,
    getGoogleAuthUrl,
    getHuggingFaceAuthUrl,
    getMicrosoftAuthUrl,
    getNotionAuthUrl,
    getSlackAuthUrl,
    getXAuthUrl,
    handleDiscordCallback,
    handleGithubCallback,
    handleGitLabCallback,
    handleGoogleCallback,
    handleGoogleToken,
    handleHuggingFaceCallback,
    handleMicrosoftCallback,
    handleNotionCallback,
    handleSlackCallback,
    handleXCallback
} from '../../controllers/v1/oauthController.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';

/**
 * @swagger
 * /api/v1/auth/github:
 *   get:
 *     summary: Get GitHub OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: GitHub OAuth URL
 */
router.get('/github', getGithubAuthUrl);

/**
 * @swagger
 * /api/v1/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/github/callback', handleGithubCallback);

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Get Google OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Google OAuth URL
 */
router.get('/google', getGoogleAuthUrl);

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/google/callback', handleGoogleCallback);

/**
 * @swagger
 * /api/v1/auth/microsoft:
 *   get:
 *     summary: Get Microsoft OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Microsoft OAuth URL
 */
router.get('/microsoft', getMicrosoftAuthUrl);

/**
 * @swagger
 * /api/v1/auth/microsoft/callback:
 *   get:
 *     summary: Microsoft OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/microsoft/callback', handleMicrosoftCallback);

/**
 * @swagger
 * /api/v1/auth/discord:
 *   get:
 *     summary: Get Discord OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Discord OAuth URL
 */
router.get('/discord', getDiscordAuthUrl);

/**
 * @swagger
 * /api/v1/auth/discord/callback:
 *   get:
 *     summary: Discord OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/discord/callback', handleDiscordCallback);

/**
 * @swagger
 * /api/v1/auth/huggingface:
 *   get:
 *     summary: Get Hugging Face OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Hugging Face OAuth URL
 */
router.get('/huggingface', getHuggingFaceAuthUrl);

/**
 * @swagger
 * /api/v1/auth/huggingface/callback:
 *   get:
 *     summary: Hugging Face OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/huggingface/callback', handleHuggingFaceCallback);

/**
 * @swagger
 * /api/v1/auth/gitlab:
 *   get:
 *     summary: Get GitLab OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: GitLab OAuth URL
 */
router.get('/gitlab', getGitLabAuthUrl);

/**
 * @swagger
 * /api/v1/auth/gitlab/callback:
 *   get:
 *     summary: GitLab OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/gitlab/callback', handleGitLabCallback);

/**
 * @swagger
 * /api/v1/auth/slack:
 *   get:
 *     summary: Get Slack OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Slack OAuth URL
 */
router.get('/slack', getSlackAuthUrl);

/**
 * @swagger
 * /api/v1/auth/slack/callback:
 *   get:
 *     summary: Slack OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/slack/callback', handleSlackCallback);

/**
 * @swagger
 * /api/v1/auth/notion:
 *   get:
 *     summary: Get Notion OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Notion OAuth URL
 */
router.get('/notion', getNotionAuthUrl);

/**
 * @swagger
 * /api/v1/auth/notion/callback:
 *   get:
 *     summary: Notion OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/notion/callback', handleNotionCallback);

/**
 * @swagger
 * /api/v1/auth/x:
 *   get:
 *     summary: Get X (Twitter) OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: X OAuth URL
 */
router.get('/x', getXAuthUrl);

/**
 * @swagger
 * /api/v1/auth/x/callback:
 *   get:
 *     summary: X (Twitter) OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/x/callback', handleXCallback);

/**
 * @swagger
 * /api/v1/auth/google/token:
 *   post:
 *     summary: Login with Google ID token (One Tap)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid token
 */
router.post('/google/token', handleGoogleToken);

/**
 * @swagger
 * /api/v1/auth/mfa/preferences:
 *   get:
 *     summary: Get MFA preferences
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA preferences
 *       401:
 *         description: Unauthorized
 */
router.get('/mfa/preferences', protectRoute, getMfaPreferences);

/**
 * @swagger
 * /api/v1/auth/mfa/preferences:
 *   put:
 *     summary: Update MFA preferences
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailMfaEnabled:
 *                 type: boolean
 *               notificationMfaEnabled:
 *                 type: boolean
 *               acknowledgeSecurityRisk:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated
 *       400:
 *         description: Security risk not acknowledged
 *       401:
 *         description: Unauthorized
 */
router.put('/mfa/preferences', protectRoute, updateMfaPreferences);

/**
 * @swagger
 * /api/v1/auth/mfa/send-email-otp:
 *   post:
 *     summary: Send email OTP for MFA verification
 *     tags: [Authentication]
 *     security: []
 *     description: Sends a 6-digit OTP to the user's email for MFA verification. Requires active MFA session.
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Email MFA not enabled
 *       401:
 *         description: No MFA session
 */
router.post('/mfa/send-email-otp', loginLimiter, sendEmailOtp);

/**
 * @swagger
 * /api/v1/auth/mfa/send-notification-otp:
 *   post:
 *     summary: Send notification OTP for MFA verification
 *     tags: [Authentication]
 *     security: []
 *     description: Sends a 6-digit OTP via in-app notification for MFA verification. Requires active MFA session.
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Notification MFA not enabled
 *       401:
 *         description: No MFA session
 */
router.post('/mfa/send-notification-otp', loginLimiter, sendNotificationOtp);

/**
 * @swagger
 * /api/v1/auth/mfa/verify-otp:
 *   post:
 *     summary: Verify email/notification OTP for MFA
 *     tags: [Authentication]
 *     security: []
 *     description: Verifies the OTP sent via email or notification and completes MFA login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - method
 *             properties:
 *               code:
 *                 type: string
 *                 description: The 6-digit OTP
 *               method:
 *                 type: string
 *                 enum: [email, notification]
 *     responses:
 *       200:
 *         description: MFA verification successful
 *       400:
 *         description: Invalid or expired code
 *       401:
 *         description: No MFA session
 */
router.post('/mfa/verify-otp', loginLimiter, verifyMfaOtp);

export default router;
