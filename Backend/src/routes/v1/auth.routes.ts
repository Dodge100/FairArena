import { Router, text } from 'express';
import {
  changePassword,
  checkMfaSession,
  exchangeOAuthTokenForSession,
  forgotPassword,
  getCurrentUser,
  getLoggedInAccounts,
  getMfaPreferences,
  getRecentActivity,
  invalidateMfaSession,
  listSessions,
  login,
  logout,
  logoutAll,
  logoutAllAccounts,
  register,
  resendVerificationEmail,
  resetPassword,
  revokeSession,
  sendEmailOtp,
  sendNotificationOtp,
  switchAccount,
  updateMfaPreferences,
  verifyEmail,
  verifyLoginMFA,
  verifyMfaOtp,
} from '../../controllers/v1/authController.js';
import { protectRoute, protectStreamRoute } from '../../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../../middleware/authRateLimit.middleware.js';
import { verifyRecaptcha } from '../../middleware/v1/captcha.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     tags: [Authentication]
 *     description: Retrieve a new CSRF token (automatically set in cookie and header)
 *     responses:
 *       200:
 *         description: CSRF token set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/csrf-token', (req, res) => {
  res.status(200).json({ success: true, message: 'CSRF token set' });
});

const loginLimiter = createAuthRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 login attempts per minute per IP
  message: 'Too many login attempts. Please try again later.',
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
router.post('/register', verifyRecaptcha, register);

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
router.post('/login', verifyRecaptcha, login);

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
router.post('/verify-mfa', verifyRecaptcha, verifyLoginMFA);

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
router.post('/forgot-password', verifyRecaptcha, forgotPassword);

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
router.post('/reset-password', verifyRecaptcha, resetPassword);

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
router.post(
  '/resend-verification',
  resendVerificationLimiter,
  verifyRecaptcha,
  resendVerificationEmail,
);

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
router.post('/mfa/invalidate', invalidateMfaSession);

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
router.post('/mfa/send-email-otp', sendEmailOtp);

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
router.post('/mfa/send-notification-otp', sendNotificationOtp);

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
router.post('/mfa/verify-otp', verifyRecaptcha, verifyMfaOtp);

// ============================================================================
// DEVICE CODE AUTHENTICATION ROUTES (RFC 8628)
// ============================================================================

/**
 * @swagger
 * /api/v1/auth/device/code:
 *   post:
 *     summary: Initiate device authorization flow
 *     tags: [Authentication, Device]
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device code generated
 */
router.post('/device/code', initiateDeviceAuth);

/**
 * @swagger
 * /api/v1/auth/device/token:
 *   post:
 *     summary: Poll for device access token
 *     tags: [Authentication, Device]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceCode]
 *             properties:
 *               deviceCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token returned
 *       400:
 *         description: Pending or invalid
 */
router.post('/device/token', pollDeviceToken);

/**
 * @swagger
 * /api/v1/auth/device/verify:
 *   post:
 *     summary: Verify user code
 *     tags: [Authentication, Device]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userCode]
 *             properties:
 *               userCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code valid
 */
router.post('/device/verify', verifyDeviceUserCode);

/**
 * @swagger
 * /api/v1/auth/device/approve:
 *   post:
 *     summary: Approve device authorization
 *     tags: [Authentication, Device]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userCode, approve]
 *             properties:
 *               userCode:
 *                 type: string
 *               approve:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Approved or denied
 */
router.post('/device/approve', protectRoute, approveDeviceAuth);

// ============================================================================
// QR CODE AUTHENTICATION ROUTES
// ============================================================================

/**
 * @swagger
 * /api/v1/auth/qr/generate:
 *   post:
 *     summary: Generate a new QR auth session
 *     tags: [Authentication, QR]
 *     security: []
 *     responses:
 *       200:
 *         description: QR session generated
 */
router.post('/qr/generate', generateQRSession);

/**
 * @swagger
 * /api/v1/auth/qr/status/{sessionId}:
 *   get:
 *     summary: Stream QR session status (SSE)
 *     tags: [Authentication, QR]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server-sent events stream
 */
router.get('/qr/status/:sessionId', streamQRStatus);

/**
 * @swagger
 * /api/v1/auth/qr/approve:
 *   post:
 *     summary: Approve QR login from authenticated device
 *     tags: [Authentication, QR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login approved
 */
router.post('/qr/approve', protectRoute, approveQRSession);

/**
 * @swagger
 * /api/v1/auth/qr/claim:
 *   post:
 *     summary: Claim approved session tokens
 *     tags: [Authentication, QR]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, nonce]
 *             properties:
 *               sessionId:
 *                 type: string
 *               nonce:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/qr/claim', claimQRSession);

/**
 * @swagger
 * /api/v1/auth/qr/device-info:
 *   post:
 *     summary: Get device info for approval confirmation
 *     tags: [Authentication, QR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device info retrieved
 */
router.post('/qr/device-info', protectRoute, getQRDeviceInfo);

// ============================================================================
// MULTI-ACCOUNT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/v1/auth/accounts:
 *   get:
 *     summary: Get all logged-in accounts
 *     tags: [Authentication, Multi-Account]
 *     security: []
 *     responses:
 *       200:
 *         description: List of logged-in accounts
 */
router.get('/accounts', getLoggedInAccounts);

/**
 * @swagger
 * /api/v1/auth/accounts/switch:
 *   post:
 *     summary: Switch to a different logged-in account
 *     tags: [Authentication, Multi-Account]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Switched account successfully
 *       404:
 *         description: Session not found
 */
router.post('/accounts/switch', switchAccount);

/**
 * @swagger
 * /api/v1/auth/accounts/logout-all:
 *   post:
 *     summary: Logout from all accounts
 *     tags: [Authentication, Multi-Account]
 *     security: []
 *     responses:
 *       200:
 *         description: All accounts logged out
 */
router.post('/accounts/logout-all', logoutAllAccounts);

/**
 * @swagger
 * /api/v1/auth/oauth/session:
 *   post:
 *     summary: Exchange OAuth access token for session cookies
 *     tags: [Authentication, OAuth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [access_token]
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: OAuth access token from device flow or other OAuth grants
 *     responses:
 *       200:
 *         description: Session created successfully
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: User banned
 */
router.post('/oauth/session', loginLimiter, exchangeOAuthTokenForSession);

// OAuth Routes
import {
  approveDeviceAuth,
  initiateDeviceAuth,
  pollDeviceToken,
  verifyDeviceUserCode,
} from '../../controllers/v1/deviceAuthController.js';
import {
  getAtlassianAuthUrl,
  getDiscordAuthUrl,
  getDropboxAuthUrl,
  getFigmaAuthUrl,
  getGithubAuthUrl,
  getGitLabAuthUrl,
  getGoogleAuthUrl,
  getHuggingFaceAuthUrl,
  getLinearAuthUrl,
  getLinkedInAuthUrl,
  getMicrosoftAuthUrl,
  getNotionAuthUrl,
  getSlackAuthUrl,
  getVercelAuthUrl,
  getXAuthUrl,
  getZohoAuthUrl,
  getZoomAuthUrl,
  handleAtlassianCallback,
  handleDiscordCallback,
  handleDropboxCallback,
  handleFigmaCallback,
  handleGithubCallback,
  handleGitLabCallback,
  handleGoogleCallback,
  handleGoogleRiscEvent,
  handleGoogleToken,
  handleHuggingFaceCallback,
  handleLinearCallback,
  handleLinkedInCallback,
  handleMicrosoftCallback,
  handleNotionCallback,
  handleSlackCallback,
  handleVercelCallback,
  handleXCallback,
  handleZohoCallback,
  handleZoomCallback,
  ssoCallback,
  ssoCheck,
  ssoLogin,
} from '../../controllers/v1/oauthController.js';
import {
  approveQRSession,
  claimQRSession,
  generateQRSession,
  getQRDeviceInfo,
  streamQRStatus,
} from '../../controllers/v1/qrAuthController.js';
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
 * /api/v1/auth/google/risc:
 *   post:
 *     summary: Handle Google RISC events (Cross-Account Protection)
 *     tags: [Authentication, Google]
 *     security: []
 *     requestBody:
 *       content:
 *         application/secevent+jwt:
 *           schema:
 *             type: string
 *     responses:
 *       202:
 *         description: Event accepted
 *       400:
 *         description: Invalid event
 */
router.post('/google/risc', text({ type: 'application/secevent+jwt' }), handleGoogleRiscEvent);

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
 * /api/v1/auth/zoho:
 *   get:
 *     summary: Get Zoho OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Zoho OAuth URL
 */
router.get('/zoho', getZohoAuthUrl);

/**
 * @swagger
 * /api/v1/auth/zoho/callback:
 *   get:
 *     summary: Zoho OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/zoho/callback', handleZohoCallback);

/**
 * @swagger
 * /api/v1/auth/linear:
 *   get:
 *     summary: Get Linear OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Linear OAuth URL
 */
router.get('/linear', getLinearAuthUrl);

/**
 * @swagger
 * /api/v1/auth/linear/callback:
 *   get:
 *     summary: Linear OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/linear/callback', handleLinearCallback);

/**
 * @swagger
 * /api/v1/auth/dropbox:
 *   get:
 *     summary: Get Dropbox OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Dropbox OAuth URL
 */
router.get('/dropbox', getDropboxAuthUrl);

/**
 * @swagger
 * /api/v1/auth/dropbox/callback:
 *   get:
 *     summary: Dropbox OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/dropbox/callback', handleDropboxCallback);

/**
 * @swagger
 * /api/v1/auth/linkedin:
 *   get:
 *     summary: Get LinkedIn OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: LinkedIn OAuth URL
 */
router.get('/linkedin', getLinkedInAuthUrl);

/**
 * @swagger
 * /api/v1/auth/linkedin/callback:
 *   get:
 *     summary: LinkedIn OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/linkedin/callback', handleLinkedInCallback);

/**
 * @swagger
 * /api/v1/auth/vercel:
 *   get:
 *     summary: Get Vercel OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Vercel OAuth URL
 */
router.get('/vercel', getVercelAuthUrl);

/**
 * @swagger
 * /api/v1/auth/vercel/callback:
 *   get:
 *     summary: Vercel OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/vercel/callback', handleVercelCallback);

/**
 * @swagger
 * /api/v1/auth/figma:
 *   get:
 *     summary: Get Figma OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Figma OAuth URL
 */
router.get('/figma', getFigmaAuthUrl);

/**
 * @swagger
 * /api/v1/auth/figma/callback:
 *   get:
 *     summary: Figma OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/figma/callback', handleFigmaCallback);

/**
 * @swagger
 * /api/v1/auth/zoom:
 *   get:
 *     summary: Get Zoom OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Zoom OAuth URL
 */
router.get('/zoom', getZoomAuthUrl);

/**
 * @swagger
 * /api/v1/auth/zoom/callback:
 *   get:
 *     summary: Zoom OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/zoom/callback', handleZoomCallback);

/**
 * @swagger
 * /api/v1/auth/atlassian:
 *   get:
 *     summary: Get Atlassian OAuth URL
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Atlassian OAuth URL
 */
router.get('/atlassian', getAtlassianAuthUrl);

/**
 * @swagger
 * /api/v1/auth/atlassian/callback:
 *   get:
 *     summary: Atlassian OAuth callback
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend
 */
router.get('/atlassian/callback', handleAtlassianCallback);

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

import { streamController } from '../../controllers/v1/streamController.js';

/**
 * @swagger
 * /api/v1/auth/stream:
 *   get:
 *     summary: Unified SSE stream for realtime events
 *     tags: [Authentication, Realtime]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server-sent events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Connection already exists
 */
router.get('/stream', protectStreamRoute, streamController.stream);

export default router;

// ============================================
// ENTERPRISE SSO ROUTES
// ============================================
router.get('/sso/check', ssoCheck);
router.get('/sso/login', ssoLogin);
router.get('/sso/callback', ssoCallback);
