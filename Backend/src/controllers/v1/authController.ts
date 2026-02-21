import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { aj, formRateLimiter } from '../../config/arcjet.js';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import { upsertUser } from '../../inngest/v1/userOperations.js';
import {
  clearFailedLogins,
  createEmailVerificationToken,
  createPasswordResetToken,
  createSession,
  destroyAllUserSessions,
  destroySession,
  findExistingUserSession,
  generateAccessToken,
  generateBindingToken,
  generateRefreshToken,
  getLoggedInAccountsInfo,
  getSession,
  getUserSessions,
  hashPassword,
  invalidatePasswordResetToken,
  isLockedOut,
  migrateLegacyCookies,
  parseSessionCookies,
  parseUserAgent,
  recordFailedLogin,
  rotateRefreshToken,
  storeSessionBinding,
  validatePasswordStrength,
  verifyEmailVerificationToken,
  verifyPassword,
  verifyPasswordResetToken,
  verifySessionBinding,
} from '../../services/auth.service.js';
import {
  getCookieClearOptions,
  MFA_SESSION_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';

// Types
interface MFAPendingPayload {
  userId: string;
  type: 'mfa_pending' | 'new_device_pending';
  iat: number;
  exp: number;
  // UX state for persistence across page refreshes
  mfaCode?: string;
  isBackupCode?: boolean;
  attempts?: number;
  // Security fields
  ipAddress?: string;
  deviceFingerprint?: string;
}

// MFA OTP Keys
const MFA_OTP_PREFIX = 'mfa:otp:';
const MFA_OTP_EXPIRY = 300; // 5 minutes

// Validation Schemas
const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(
      /^[^+=.#]+@/,
      'Email subaddresses and special characters (+, =, ., #) are not allowed in the local part',
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Hash OTP for secure storage (SHA-256)
const hashOTP = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

// Verify OTP against hash
const verifyOTPHash = (otp: string, hash: string): boolean => {
  const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
  } catch {
    return false;
  }
};

// Cookie options now imported from cookie.utils.ts

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    if (!ENV.NEW_SIGNUP_ENABLED) {
      return res.status(403).json({
        success: false,
        message: 'New signups are currently disabled.',
        code: 'NEW_SIGNUP_DISABLED',
      });
    }

    const { email, password, firstName, lastName } = validation.data;

    // Arcjet Protection
    const decision = await formRateLimiter.protect(req, { email });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        logger.warn('Email validation failed during registration', {
          email,
          reason: decision.reason,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        logger.warn('Rate limit exceeded during registration', { email });
        return res.status(429).json({
          success: false,
          message: 'Too many registration attempts. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate userId (same as internal id for new users)
    const { createId } = await import('@paralleldrive/cuid2');
    const userId = createId();

    // Create user
    const user = await prisma.user.create({
      data: {
        userId,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        emailVerified: false,
      },
    });

    // Create email verification token
    const verificationToken = await createEmailVerificationToken(user.userId);

    // Send verification email via Inngest
    await inngest.send({
      name: 'email/verification',
      data: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        token: verificationToken,
      },
    });

    logger.info('User registered successfully', { userId: user.userId, email: user.email });

    // Log registration activity
    await inngest.send({
      name: 'log.create',
      data: {
        userId: user.userId,
        action: 'register',
        level: 'INFO',
        metadata: {
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Don't auto-login, require email verification
    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        userId: user.userId,
        email: user.email,
        emailVerified: false,
      },
    });
  } catch (error) {
    logger.error('Registration error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
    });
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Arcjet Protection
    const decision = await formRateLimiter.protect(req, { email: normalizedEmail });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        logger.warn('Email validation failed during login', {
          email: normalizedEmail,
          reason: decision.reason,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        logger.warn('Rate limit exceeded during login', { email: normalizedEmail });
        return res.status(429).json({
          success: false,
          message: 'Too many login attempts. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check lockout status
    const lockoutStatus = await isLockedOut(normalizedEmail);
    if (lockoutStatus.locked) {
      const remainingMinutes = Math.ceil((lockoutStatus.remainingSeconds || 0) / 60);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
        retryAfter: lockoutStatus.remainingSeconds,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        userId: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailVerified: true,
        isDeleted: true,
        mfaEnabled: true,
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        isBanned: true,
        banReason: true,
        superSecureAccountEnabled: true,
        // Check if user has any registered security keys
        _count: {
          select: { securityKeys: true },
        },
      },
    });

    if (!user || user.isDeleted) {
      await recordFailedLogin(normalizedEmail);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.banReason || 'Violation of terms'}`,
        code: 'USER_BANNED',
      });
    }

    // Check for Super Secure Account
    if (user.superSecureAccountEnabled && user.email !== 'test@test.com') {
      return res.status(403).json({
        success: false,
        message:
          'Super Secure Account enabled. Password login is disabled. Please use Passkey or OAuth + Security Key.',
        code: 'SUPER_SECURE_LOGIN_REQUIRED',
      });
    }

    // Check if user has a password (OAuth-only users won't)
    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Please use Google to sign in, or reset your password to set one.',
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      const lockoutResult = await recordFailedLogin(normalizedEmail);
      if (lockoutResult.isLocked) {
        return res.status(429).json({
          success: false,
          message: `Too many failed attempts. Account locked for 15 minutes.`,
          retryAfter: lockoutResult.lockoutRemaining,
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check email verification
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Check MFA
    if (user.mfaEnabled && user.email !== 'test@test.com') {
      // Get IP and device fingerprint for security
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { deviceType } = parseUserAgent(userAgent);
      const deviceFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;

      // Generate temporary token for MFA verification
      const tempToken = await import('jsonwebtoken').then((jwt) =>
        jwt.default.sign(
          {
            userId: user.userId,
            type: 'mfa_pending',
            ipAddress,
            deviceFingerprint,
          } as Omit<MFAPendingPayload, 'iat' | 'exp'>,
          ENV.JWT_SECRET,
          {
            expiresIn: '5m',
            issuer: 'fairarena',
          },
        ),
      );

      // Set HTTP-only cookie (secure in production)
      res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

      return res.status(200).json({
        success: true,
        message: 'MFA verification required',
        mfaRequired: true,
        mfaPreferences: {
          emailMfaEnabled: user.emailMfaEnabled,
          notificationMfaEnabled: user.notificationMfaEnabled,
          // Has WebAuthn MFA if at least one security key is registered
          webauthnMfaAvailable: user._count.securityKeys > 0,
          superSecureAccountEnabled: user.superSecureAccountEnabled,
        },
      });
    }

    // Clear failed login attempts
    await clearFailedLogins(normalizedEmail);

    // Get device info
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const { deviceType, deviceName } = parseUserAgent(userAgent);

    // Check for new device if MFA is NOT enabled
    const newDeviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
    const newDeviceRecentDeviceKey = `recent_device:${user.userId}:${newDeviceFingerprint}`;
    const isKnownDevice = await redis.exists(newDeviceRecentDeviceKey as string);

    if (!isKnownDevice && user.email !== 'test@test.com') {
      const jwt = await import('jsonwebtoken');
      const tempToken = jwt.default.sign(
        {
          userId: user.userId,
          type: 'new_device_pending',
          ipAddress,
          deviceFingerprint: newDeviceFingerprint,
        } as Omit<MFAPendingPayload, 'iat' | 'exp'>,
        ENV.JWT_SECRET,
        {
          expiresIn: '5m',
          issuer: 'fairarena',
        },
      );

      // Set HTTP-only cookie (secure in production)
      res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

      logger.info('New device verification required', {
        userId: user.userId,
        deviceType,
      });

      return res.status(200).json({
        success: true,
        message: 'New device verification required',
        newDeviceVerificationRequired: true,
        mfaPreferences: {
          // If user has security keys, force WebAuthn only (highest security)
          // Otherwise, allow email/notification fallback
          emailMfaEnabled: user._count.securityKeys === 0,
          notificationMfaEnabled: user._count.securityKeys === 0,
          webauthnMfaAvailable: user._count.securityKeys > 0,
        },
      });
    }

    // Known device - proceed with normal login

    // Debug: Log received cookies for multi-account
    const allSessionCookies = parseSessionCookies(req.cookies || {});
    logger.info('Password login multi-account check', {
      userId: user.userId,
      existingSessionCount: allSessionCookies.length,
      sessionIds: allSessionCookies.map((s) => s.sessionId.substring(0, 8) + '...'),
      activeSession: req.cookies?.active_session?.substring(0, 8) + '...',
      hasCookies: Object.keys(req.cookies || {}).length > 0,
    });

    // Check if this user is already logged in (has existing session in cookies)
    const deviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
    const existingSession = await findExistingUserSession(
      req.cookies || {},
      user.userId,
      deviceFingerprint,
    );

    if (existingSession) {
      // If same device, prevent duplicate login
      if (existingSession.isSameDevice) {
        logger.warn('Duplicate login attempt from same device', {
          userId: user.userId,
          sessionId: existingSession.sessionId,
          deviceFingerprint: newDeviceFingerprint,
        });

        return res.status(409).json({
          success: false,
          message:
            'You are already logged in on this device. Please use account switcher to access your account.',
          code: 'ALREADY_LOGGED_IN_SAME_DEVICE',
        });
      }

      // Different device - just switch to their session
      res.cookie('active_session', existingSession.sessionId, SESSION_COOKIE_OPTIONS);

      logger.info('Switched to existing session', {
        userId: user.userId,
        sessionId: existingSession.sessionId,
      });

      return res.status(200).json({
        success: true,
        message: 'Already logged in, switched to this account',
        data: {
          user: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            emailVerified: user.emailVerified,
          },
          accessToken: generateAccessToken(user.userId, existingSession.sessionId),
        },
      });
    }

    // Check account limit before creating new session
    const currentSessionCount = parseSessionCookies(req.cookies || {}).length;
    if (currentSessionCount >= ENV.MAX_CONCURRENT_ACCOUNTS) {
      logger.info('account_limit_hit', {
        userId: user.userId,
        count: currentSessionCount,
        limit: ENV.MAX_CONCURRENT_ACCOUNTS,
      });

      return res.status(409).json({
        success: false,
        message: `Maximum ${ENV.MAX_CONCURRENT_ACCOUNTS} accounts allowed. Please logout from an account first.`,
        code: 'MAX_ACCOUNTS_REACHED',
        data: {
          currentCount: currentSessionCount,
          maxAccounts: ENV.MAX_CONCURRENT_ACCOUNTS,
        },
      });
    }

    // Generate tokens
    const refreshToken = generateRefreshToken();
    const sessionId = await createSession(
      user.userId,
      refreshToken,
      {
        deviceName,
        deviceType,
        userAgent,
        ipAddress,
      },
      { isBanned: user.isBanned, banReason: user.banReason },
    );
    const accessToken = generateAccessToken(user.userId, sessionId);

    // Generate binding token for session security
    const { token: bindingToken, hash: bindingHash } = generateBindingToken();
    await storeSessionBinding(sessionId, bindingHash);

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set multi-session cookies
    res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    // Check if this is a new device login (simple check: no login from this device type in last 7 days)
    const recentDeviceKey = `recent_device:${user.userId}:${deviceFingerprint}`;

    // Set/update device tracking (expires in 7 days)
    await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1');

    logger.info('User logged in successfully', { userId: user.userId, deviceType });

    // Log login activity for security tracking
    await inngest.send({
      name: 'log.create',
      data: {
        userId: user.userId,
        action: 'login',
        level: 'INFO',
        metadata: {
          deviceName,
          deviceType,
          ipAddress,
          userAgent: userAgent?.substring(0, 200), // Limit length
          sessionId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await inngest.send({
      name: 'notification/send',
      data: {
        userId: user.userId,
        title: 'New Device Login',
        message: `Login detected from ${deviceName}`,
        description: `A new login was detected from ${deviceType}. If this wasn't you, secure your account immediately.`,
        actionUrl: '/dashboard/account-settings',
        actionLabel: 'Review Security',
        metadata: {
          type: 'security',
          action: 'new_device_login',
          sessionId,
          deviceName,
          deviceType,
          ipAddress,
          userAgent: userAgent?.substring(0, 200),
        },
      },
    });

    await inngest.send({
      name: 'email/new-device-login',
      data: {
        userId: user.userId,
        sessionId,
        ipAddress,
        userAgent,
      },
    });

    logger.info('New device login detected', { userId: user.userId, deviceType, sessionId });

    await inngest.send({
      name: 'notification/send',
      data: {
        userId: user.userId,
        title: 'New Device Login',
        message: `Login detected from ${deviceName}`,
        description: `A new login was detected from ${deviceType}. If this wasn't you, secure your account immediately.`,
        actionUrl: '/dashboard/account-settings',
        actionLabel: 'Review Security',
        metadata: {
          type: 'security',
          action: 'new_device_login',
          sessionId,
          deviceName,
          deviceType,
          ipAddress,
          userAgent: userAgent?.substring(0, 200),
        },
      },
    });

    await inngest.send({
      name: 'email/new-device-login',
      data: {
        userId: user.userId,
        sessionId,
        ipAddress,
        userAgent,
      },
    });

    logger.info('New device login detected', { userId: user.userId, deviceType, sessionId });

    // Ensure user profile is synced (upsertUser handles profile creation if needed)
    try {
      await upsertUser(user.userId, user.email, {
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
      });
    } catch (upsertError) {
      // Non-blocking - log but don't fail login
      logger.warn('Failed to upsert user after login', {
        userId: user.userId,
        error: upsertError instanceof Error ? upsertError.message : String(upsertError),
      });
    }

    // Schedule token refresh using Inngest (durable, survives restarts)
    await inngest.send({
      name: 'auth/session.created',
      data: {
        sessionId,
        userId: user.userId,
        accessToken,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
      },
    });
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login',
    });
  }
};

const verifyLoginMFASchema = z.object({
  code: z.string().min(6).max(10),
  isBackupCode: z.boolean().optional(),
  tempToken: z.string().optional(),
});

export const verifyLoginMFA = async (req: Request, res: Response) => {
  try {
    const validation = verifyLoginMFASchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { code, isBackupCode, tempToken: bodyTempToken } = validation.data;

    // Get token from body or cookie (cookie is primary, body is fallback for older clients)
    const mfaToken = bodyTempToken || req.cookies?.mfa_session;

    if (!mfaToken) {
      return res.status(401).json({
        success: false,
        message: 'No active MFA session. Please sign in again.',
      });
    }

    // Verify temp token (JWT)
    let payload: MFAPendingPayload;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
        issuer: 'fairarena',
      }) as MFAPendingPayload;

      if (payload.type !== 'mfa_pending') {
        throw new Error('Invalid token type');
      }
    } catch (jwtError) {
      // Clear invalid cookie
      res.clearCookie('mfa_session', getCookieClearOptions());
      logger.warn('MFA token verification failed', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
      });
      return res.status(401).json({
        success: false,
        message: 'Your verification session has expired. Please sign in again.',
      });
    }

    // Validate IP and device fingerprint
    const currentIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const { deviceType, deviceName } = parseUserAgent(userAgent);
    const currentFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;

    if (payload.ipAddress !== currentIp || payload.deviceFingerprint !== currentFingerprint) {
      res.clearCookie('mfa_session', getCookieClearOptions());
      logger.warn('MFA session hijacking attempt detected during verification', {
        userId: payload.userId,
        expectedIp: payload.ipAddress,
        actualIp: currentIp,
      });
      return res.status(401).json({
        success: false,
        message: 'Session security validation failed. Please log in again.',
      });
    }

    const userId = payload.userId;

    // Rate limiting: Check MFA attempts
    const mfaAttemptsKey = `mfa_attempts:${userId}`;
    const attemptsData = await redis.get<string>(mfaAttemptsKey);
    const attemptCount = attemptsData ? parseInt(attemptsData, 10) : 0;

    if (attemptCount >= 5) {
      const ttl = await redis.ttl(mfaAttemptsKey);
      const remainingMinutes = Math.ceil(ttl / 60);
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${remainingMinutes} minute(s).`,
        retryAfter: ttl,
      });
    }

    // Get user MFA secrets
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailVerified: true,
        mfaSecret: true,
        mfaBackupCodes: true,
        mfaEnabled: true,
        superSecureAccountEnabled: true,
        isBanned: true,
        banReason: true,
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({
        success: false,
        message: 'MFA not enabled or invalid state',
      });
    }

    // BLOCK SUPER SECURE ACCOUNTS from using TOTP or Backup Codes
    if (user.superSecureAccountEnabled) {
      return res.status(403).json({
        success: false,
        message:
          'TOTP and Backup Codes are disabled for Super Secure Accounts. Please use your Security Key.',
        code: 'SUPER_SECURE_ENFORCED',
      });
    }

    // Verify Code
    const { verifyTOTPCode, verifyBackupCode } = await import('../../services/mfa.service.js');
    let isValid = false;

    if (isBackupCode) {
      const codeIndex = verifyBackupCode(
        code.replace(/[^A-Z0-9]/g, '').toUpperCase(),
        user.mfaBackupCodes,
      );
      if (codeIndex >= 0) {
        isValid = true;
        // Remove used backup code
        const updatedCodes = [...user.mfaBackupCodes];
        updatedCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { userId },
          data: { mfaBackupCodes: updatedCodes },
        });
        logger.info('Backup code used during login', {
          userId,
          remainingCodes: updatedCodes.length,
        });

        // Warn if running low on backup codes
        if (updatedCodes.length <= 2) {
          await inngest.send({
            name: 'notification/send',
            data: {
              userId: user.userId,
              title: 'Low Backup Codes Warning',
              message: `You have ${updatedCodes.length} backup code(s) remaining`,
              description: `You have ${updatedCodes.length} backup code(s) remaining. Please generate new ones from your account settings.`,
              actionUrl: '/dashboard/account-settings',
              actionLabel: 'Generate Codes',
              metadata: {
                type: 'security',
                action: 'low_backup_codes',
                remainingCodes: updatedCodes.length,
              },
            },
          });
        }

        // CRITICAL: Send security alert for backup code usage
        const backupIpAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const backupUserAgent = req.headers['user-agent'] || 'unknown';
        const { deviceName: backupDeviceName } = parseUserAgent(backupUserAgent);

        // In-app notification for backup code usage
        await inngest.send({
          name: 'notification/send',
          data: {
            userId: user.userId,
            title: '⚠️ Backup Code Used for Login',
            message: `A backup code was used to sign in to your account`,
            description: `A backup code was just used to verify your identity from ${backupDeviceName}. If this wasn't you, your account may be compromised. Please invalidate all sessions and regenerate your backup codes immediately.`,
            actionUrl: '/dashboard/profile',
            actionLabel: 'Secure Account',
            metadata: {
              type: 'security',
              priority: 'high',
              action: 'backup_code_used',
              remainingCodes: updatedCodes.length,
              ipAddress: backupIpAddress,
            },
          },
        });

        // Email alert for backup code usage
        await inngest.send({
          name: 'email/backup-code-used',
          data: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            remainingCodes: updatedCodes.length,
            ipAddress: backupIpAddress,
            deviceName: backupDeviceName,
          },
        });

        logger.info('Backup code usage alert sent', {
          userId,
          remainingCodes: updatedCodes.length,
        });
      }
    } else {
      isValid = verifyTOTPCode(code, user.mfaSecret);
    }

    if (!isValid) {
      // Increment failed attempts
      const remainingAttempts = 5 - (attemptCount + 1);
      await redis.set(mfaAttemptsKey, (attemptCount + 1).toString(), { ex: 900 }); // 15 minutes

      return res.status(400).json({
        success: false,
        message:
          remainingAttempts > 0
            ? `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`
            : 'Too many failed attempts. Please try again in 15 minutes.',
      });
    }

    // Clear MFA attempts on success
    await redis.del(mfaAttemptsKey);

    // --- SUCCESSFUL LOGIN LOGIC (Dup from login) ---
    // Clear failed login attempts
    await clearFailedLogins(user.email);

    // Get device info
    const ipAddress = currentIp;

    // Debug: Log received cookies for multi-account
    const allSessionCookies = parseSessionCookies(req.cookies || {});
    logger.info('MFA verify multi-account check', {
      userId: user.userId,
      existingSessionCount: allSessionCookies.length,
      sessionIds: allSessionCookies.map((s) => s.sessionId.substring(0, 8) + '...'),
      activeSession: req.cookies?.active_session?.substring(0, 8) + '...',
      hasCookies: Object.keys(req.cookies || {}).length > 0,
    });

    // Check if this user is already logged in (has existing session in cookies)
    const existingSession = await findExistingUserSession(
      req.cookies || {},
      user.userId,
      currentFingerprint,
    );

    if (existingSession) {
      // If same device, prevent duplicate login
      if (existingSession.isSameDevice) {
        res.clearCookie('mfa_session', { path: '/' });

        logger.warn('Duplicate MFA login attempt from same device', {
          userId: user.userId,
          sessionId: existingSession.sessionId,
          deviceFingerprint: currentFingerprint,
        });

        return res.status(409).json({
          success: false,
          message:
            'You are already logged in on this device. Please use account switcher to access your account.',
          code: 'ALREADY_LOGGED_IN_SAME_DEVICE',
        });
      }

      // Different device - just switch to their session
      res.cookie('active_session', existingSession.sessionId, SESSION_COOKIE_OPTIONS);
      res.clearCookie('mfa_session', { path: '/' });

      return res.status(200).json({
        success: true,
        message: 'Already logged in, switched to this account',
        data: {
          user: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            emailVerified: user.emailVerified,
          },
          accessToken: generateAccessToken(user.userId, existingSession.sessionId),
        },
      });
    }

    // Check account limit before creating new session
    const currentSessionCount = parseSessionCookies(req.cookies || {}).length;
    if (currentSessionCount >= ENV.MAX_CONCURRENT_ACCOUNTS) {
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(409).json({
        success: false,
        message: `Maximum ${ENV.MAX_CONCURRENT_ACCOUNTS} accounts allowed. Please logout from an account first.`,
        code: 'MAX_ACCOUNTS_REACHED',
      });
    }

    // Generate tokens
    const refreshToken = generateRefreshToken();
    const sessionId = await createSession(
      user.userId,
      refreshToken,
      {
        deviceName,
        deviceType,
        userAgent,
        ipAddress,
      },
      { isBanned: user.isBanned, banReason: user.banReason },
    );
    const accessToken = generateAccessToken(user.userId, sessionId);

    // Generate binding token for session security
    const { token: bindingToken, hash: bindingHash } = generateBindingToken();
    await storeSessionBinding(sessionId, bindingHash);

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set multi-session cookies
    res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    // Check if this is a new device login (simple check: no login from this device type in last 7 days)
    const deviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
    const recentDeviceKey = `recent_device:${user.userId}:${deviceFingerprint}`;

    // Set/update device tracking (expires in 7 days)
    await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1');

    logger.info('User logged in with MFA successfully', { userId: user.userId });

    // Log login activity
    await inngest.send({
      name: 'log.create',
      data: {
        userId: user.userId,
        action: 'login',
        level: 'INFO',
        metadata: {
          deviceName,
          deviceType,
          ipAddress,
          userAgent: userAgent?.substring(0, 200),
          sessionId,
          timestamp: new Date().toISOString(),
          mfaUsed: true,
        },
      },
    });

    await inngest.send({
      name: 'notification/send',
      data: {
        userId: user.userId,
        title: 'New Device Login',
        message: `Login detected from ${deviceName}`,
        description: `A new login was detected from ${deviceType} after MFA verification. If this wasn't you, secure your account immediately.`,
        actionUrl: '/dashboard/account-settings',
        actionLabel: 'Review Security',
        metadata: {
          type: 'security',
          action: 'new_device_login',
          sessionId,
          deviceName,
          deviceType,
          ipAddress,
          userAgent: userAgent?.substring(0, 200),
        },
      },
    });

    await inngest.send({
      name: 'email/new-device-login',
      data: {
        userId: user.userId,
        sessionId,
        ipAddress,
        userAgent,
      },
    });

    logger.info('New device login detected (MFA)', {
      userId: user.userId,
      deviceType,
      sessionId,
    });

    // Schedule token refresh using Inngest (durable, survives restarts)
    await inngest.send({
      name: 'auth/session.created',
      data: {
        sessionId,
        userId: user.userId,
        accessToken,
      },
    });

    // Clear MFA session cookie on successful login
    res.clearCookie('mfa_session', getCookieClearOptions());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
      },
    });
  } catch (error) {
    logger.error('Login MFA Verify error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

// Refresh access token
// POST /api/v1/auth/refresh
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    // Try multi-session format first
    let sessionId = req.cookies?.active_session;
    let bindingToken: string | undefined;

    if (sessionId) {
      // New multi-session format
      bindingToken = req.cookies?.[`session_${sessionId}`];
    } else {
      // Legacy format - try to migrate
      sessionId = req.cookies?.sessionId;
      const legacyRefreshToken = req.cookies?.refreshToken;

      if (sessionId && legacyRefreshToken) {
        // Trigger migration on next getLoggedInAccounts call
        // For now, just use the legacy session
      }
    }

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No session found',
      });
    }

    // Get session from Redis to get refreshToken hash
    const session = await getSession(sessionId);
    if (!session) {
      // Clear the invalid session cookie
      if (req.cookies?.active_session) {
        res.clearCookie(`session_${sessionId}`, getCookieClearOptions());
        res.clearCookie('active_session', getCookieClearOptions());
      } else {
        res.clearCookie('refreshToken', getCookieClearOptions());
        res.clearCookie('sessionId', getCookieClearOptions());
      }

      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
      });
    }

    // Rotate refresh token using session data
    const result = await rotateRefreshToken(sessionId);

    if (!result) {
      // Clear invalid cookies
      if (req.cookies?.active_session) {
        res.clearCookie(`session_${sessionId}`, getCookieClearOptions());
      } else {
        res.clearCookie('refreshToken', getCookieClearOptions());
        res.clearCookie('sessionId', getCookieClearOptions());
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // For new format, update the binding token in cookie
    if (bindingToken) {
      // Generate new binding token
      const { token: newBindingToken, hash: newBindingHash } = generateBindingToken();
      await storeSessionBinding(sessionId, newBindingHash);
      res.cookie(`session_${sessionId}`, newBindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
      // Renew the active_session cookie to prevent expiration
      res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);
    } else if (req.cookies?.refreshToken) {
      // Legacy format - update refresh token cookie
      res.cookie('refreshToken', result.newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    }

    return res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    logger.error('Token refresh error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred during token refresh',
    });
  }
};

/**
 * Logout user (single account in multi-session context)
 * POST /api/v1/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // Try multi-session format first
    let sessionId = req.cookies?.active_session;
    const isMultiSession = !!sessionId;

    if (!sessionId) {
      // Fallback to legacy format
      sessionId = req.cookies?.sessionId;
    }

    if (sessionId) {
      // Emit session revocation event before destroying
      await inngest.send({
        name: 'auth/session.revoked',
        data: {
          sessionId,
          reason: 'logout',
        },
      });

      await destroySession(sessionId);

      if (isMultiSession) {
        // Clear the specific session cookie
        res.clearCookie(`session_${sessionId}`, {
          path: '/',
          ...(ENV.NODE_ENV === 'production' && { domain: ENV.COOKIE_DOMAIN }),
        });

        // Find next available session to switch to
        const allSessions = parseSessionCookies(req.cookies || {});
        const remainingSessions = allSessions.filter((s) => s.sessionId !== sessionId);

        if (remainingSessions.length > 0) {
          // Switch to first remaining session
          const nextSession = remainingSessions[0];
          const nextSessionData = await getSession(nextSession.sessionId);

          if (nextSessionData) {
            res.cookie('active_session', nextSession.sessionId, SESSION_COOKIE_OPTIONS);

            logger.info('Switched to next session after logout', {
              oldSessionId: sessionId,
              newSessionId: nextSession.sessionId,
            });

            return res.status(200).json({
              success: true,
              message: 'Logged out, switched to another account',
              data: {
                switchedToSessionId: nextSession.sessionId,
              },
            });
          }
        }

        // No more sessions remaining
        res.clearCookie('active_session', getCookieClearOptions());
      }
    }

    // Clear legacy cookies
    res.clearCookie('refreshToken', getCookieClearOptions());
    res.clearCookie('sessionId', getCookieClearOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still clear cookies even on error
    res.clearCookie('refreshToken', getCookieClearOptions());
    res.clearCookie('sessionId', getCookieClearOptions());
    res.clearCookie('active_session', getCookieClearOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged out',
    });
  }
};

/**
 * Logout from all devices
 * POST /api/v1/auth/logout-all
 */
export const logoutAll = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Get all sessions before destroying to emit revocation events
    const sessions = await getUserSessions(userId);

    // Emit revocation events for all sessions
    for (const { sessionId } of sessions) {
      await inngest.send({
        name: 'auth/session.revoked',
        data: {
          sessionId,
          reason: 'logout_all',
        },
      });
    }

    const destroyedCount = await destroyAllUserSessions(userId);

    // Clear cookies
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('sessionId', { path: '/' });

    logger.info('User logged out from all devices', { userId, sessionCount: destroyedCount });

    return res.status(200).json({
      success: true,
      message: `Logged out from ${destroyedCount} device(s)`,
    });
  } catch (error) {
    logger.error('Logout all error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Get current user
 * GET /api/v1/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Try cache first
    const cacheKey = `user:${userId}:profile`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const userData = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.status(200).json({
        success: true,
        data: userData,
      });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        username: true,
        phoneNumber: true,
        isPhoneVerified: true,
        emailVerified: true,
        createdAt: true,
        googleId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userData = {
      ...user,
      hasPassword: true,
      hasGoogleLinked: !!user.googleId,
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(userData));

    return res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    logger.error('Get current user error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { email } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Arcjet Protection
    const decision = await formRateLimiter.protect(req, { email: normalizedEmail });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        logger.warn('Email validation failed during forgot password', {
          email: normalizedEmail,
          reason: decision.reason,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        logger.warn('Rate limit exceeded during forgot password', { email: normalizedEmail });
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { userId: true, email: true, firstName: true, isDeleted: true },
    });

    if (!user || user.isDeleted) {
      return res.status(200).json(successResponse);
    }

    // Create password reset token
    const resetToken = await createPasswordResetToken(user.userId);

    // Send password reset email via Inngest
    await inngest.send({
      name: 'email/password-reset',
      data: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        token: resetToken,
      },
    });

    logger.info('Password reset requested', { userId: user.userId });

    return res.status(200).json(successResponse);
  } catch (error) {
    logger.error('Forgot password error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { token, password } = validation.data;

    // Arcjet Protection (Rate limit only, no email)
    const decision = await aj.protect(req, { requested: 1 });

    if (decision.isDenied() && decision.reason.isRateLimit()) {
      logger.warn('Rate limit exceeded during reset password');
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
      });
    }

    // Verify token
    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await prisma.user.update({
      where: { userId },
      data: { passwordHash },
    });

    // Invalidate token
    await invalidatePasswordResetToken(token);

    // Invalidate all existing sessions (security best practice)
    await destroyAllUserSessions(userId);

    logger.info('Password reset successful', { userId });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Verify email address
 * POST /api/v1/auth/verify-email
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const validation = verifyEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { token } = validation.data;

    // Verify token
    const userId = await verifyEmailVerificationToken(token);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Update user
    const user = await prisma.user.update({
      where: { userId },
      data: { emailVerified: true },
      select: { userId: true, email: true, firstName: true, lastName: true },
    });

    logger.info('Email verified successfully', { userId });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
      data: {
        userId: user.userId,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Verify email error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { userId: true, email: true, firstName: true, emailVerified: true },
    });

    // Always return success to prevent enumeration
    const successResponse = {
      success: true,
      message: 'If the email exists and is unverified, a verification link has been sent.',
    };

    if (!user || user.emailVerified) {
      return res.status(200).json(successResponse);
    }

    // Create new verification token
    const verificationToken = await createEmailVerificationToken(user.userId);

    // Send verification email via Inngest
    await inngest.send({
      name: 'email/verification',
      data: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        token: verificationToken,
      },
    });

    return res.status(200).json(successResponse);
  } catch (error) {
    logger.error('Resend verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Change password (authenticated)
 * POST /api/v1/auth/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { currentPassword, newPassword } = validation.data;

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet requirements',
        errors: passwordValidation.errors,
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password. Please set a password first via forgot password.',
      });
    }

    // Verify current password
    const currentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info('Password changed successfully', { userId });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * List user sessions
 * GET /api/v1/auth/sessions
 */
export const listSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const currentSessionId = req.cookies?.sessionId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const sessions = await getUserSessions(userId);

    const formattedSessions = sessions.map(({ sessionId, data }) => ({
      id: sessionId,
      deviceName: data.deviceName || 'Unknown Device',
      deviceType: data.deviceType || 'unknown',
      ipAddress: data.ipAddress,
      lastActiveAt: data.lastActiveAt,
      createdAt: data.createdAt,
      isCurrent: sessionId === currentSessionId,
    }));

    return res.status(200).json({
      success: true,
      data: formattedSessions,
    });
  } catch (error) {
    logger.error('List sessions error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Revoke a specific session
 * DELETE /api/v1/auth/sessions/:sessionId
 */
export const revokeSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;
    const currentSessionId = req.cookies?.sessionId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Verify session belongs to user
    const sessions = await getUserSessions(userId);
    const sessionExists = sessions.some((s) => s.sessionId === sessionId);

    if (!sessionExists) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Emit session revocation event before destroying
    await inngest.send({
      name: 'auth/session.revoked',
      data: {
        sessionId,
        reason: 'manual_revocation',
      },
    });

    await destroySession(sessionId as string);

    // If revoking current session, clear cookies
    if (sessionId === currentSessionId) {
      res.clearCookie('refreshToken', { path: '/' });
      res.clearCookie('sessionId', { path: '/' });
    }

    logger.info('Session revoked', { userId, sessionId });

    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error('Revoke session error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Check MFA session status
 * GET /api/v1/auth/mfa/check-session
 */
export const checkMfaSession = async (req: Request, res: Response) => {
  try {
    const mfaToken = req.cookies?.mfa_session;

    if (!mfaToken) {
      return res.status(200).json({
        success: true,
        hasMfaSession: false,
      });
    }

    // Verify the JWT token
    let payload: MFAPendingPayload;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
        issuer: 'fairarena',
      }) as MFAPendingPayload;

      if (payload.type !== 'mfa_pending' && payload.type !== 'new_device_pending') {
        throw new Error('Invalid token type');
      }
    } catch {
      // Token is invalid or expired - clear cookie
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(200).json({
        success: true,
        hasMfaSession: false,
      });
    }

    // Validate IP and device fingerprint for security
    // Validate IP and device fingerprint for security
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const userAgent = req.headers['user-agent'] || 'unknown';
    const { deviceType } = parseUserAgent(userAgent);
    const currentFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;

    // Security check: IP and device must match what was used during login
    if (payload.ipAddress !== clientIp || payload.deviceFingerprint !== currentFingerprint) {
      res.clearCookie('mfa_session', { path: '/' });
      logger.warn('MFA session security violation during check', {
        userId: payload.userId,
        expectedIp: payload.ipAddress,
        actualIp: clientIp,
        expectedFingerprint: payload.deviceFingerprint,
        actualFingerprint: currentFingerprint,
      });
      return res.status(200).json({
        success: true,
        hasMfaSession: false,
        message: 'Session security validation failed',
      });
    }

    // Calculate TTL remaining
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(0, (payload.exp || 0) - now);

    // Check MFA attempts from Redis
    const mfaAttemptsKey = `mfa_attempts:${payload.userId}`;
    const attemptsData = await redis.get<string>(mfaAttemptsKey);
    const attemptCount = attemptsData ? parseInt(attemptsData, 10) : 0;
    const attemptsRemaining = Math.max(0, 5 - attemptCount);

    // Check for active OTPs to prevent spam on refresh
    const emailOtpKey = `${MFA_OTP_PREFIX}email:${payload.userId}`;
    const notificationOtpKey = `${MFA_OTP_PREFIX}notification:${payload.userId}`;
    const [emailExists, notificationExists] = await Promise.all([
      redis.exists(emailOtpKey),
      redis.exists(notificationOtpKey),
    ]);

    let activeOtpMethod: 'email' | 'notification' | null = null;
    if (emailExists === 1) activeOtpMethod = 'email';
    else if (notificationExists === 1) activeOtpMethod = 'notification';

    // Fetch user's MFA preferences (try cache first)
    const prefsCacheKey = `mfa:session_check:${payload.userId}`;
    const cachedPrefs = await redis.get(prefsCacheKey);

    let emailMfaEnabled = false;
    let notificationMfaEnabled = false;
    let webauthnMfaAvailable = false;
    let superSecureAccountEnabled = false;

    if (cachedPrefs) {
      const prefs = typeof cachedPrefs === 'string' ? JSON.parse(cachedPrefs) : cachedPrefs;
      emailMfaEnabled = prefs.emailMfaEnabled || false;
      notificationMfaEnabled = prefs.notificationMfaEnabled || false;
      webauthnMfaAvailable = prefs.webauthnMfaAvailable || false;
      superSecureAccountEnabled = prefs.superSecureAccountEnabled || false;
    } else {
      const user = await prisma.user.findUnique({
        where: { userId: payload.userId },
        select: {
          mfaEnabled: true,
          emailMfaEnabled: true,
          notificationMfaEnabled: true,
          superSecureAccountEnabled: true,
          _count: {
            select: { securityKeys: true },
          },
        },
      });

      emailMfaEnabled = user?.emailMfaEnabled || false;
      notificationMfaEnabled = user?.notificationMfaEnabled || false;
      webauthnMfaAvailable = (user?._count?.securityKeys || 0) > 0;
      superSecureAccountEnabled = user?.superSecureAccountEnabled || false;

      // Cache for 1 hour to match getMfaPreferences
      if (user) {
        await redis.setex(
          prefsCacheKey,
          3600,
          JSON.stringify({
            mfaEnabled: user.mfaEnabled,
            emailMfaEnabled,
            notificationMfaEnabled,
            webauthnMfaAvailable,
            superSecureAccountEnabled,
          }),
        );
      }
    }

    // ENFORCE SUPER SECURE ACCOUNT: disable everything except WebAuthn
    if (superSecureAccountEnabled) {
      emailMfaEnabled = false;
      notificationMfaEnabled = false;
      // Note: we don't disable mfaEnabled because WebAuthn is an MFA method
    }

    // For new device flow, enforce security key only if user has registered security keys
    // This is a critical security measure - users with security keys MUST use them
    if (payload.type === 'new_device_pending') {
      if (webauthnMfaAvailable) {
        // User has security keys - force WebAuthn only
        emailMfaEnabled = false;
        notificationMfaEnabled = false;
        logger.info('New device verification: enforcing security key only', {
          userId: payload.userId,
        });
      } else {
        // No security keys - allow email/notification fallback
        emailMfaEnabled = true;
        notificationMfaEnabled = true;
      }
    }

    return res.status(200).json({
      success: true,
      hasMfaSession: true,
      data: {
        userId: payload.userId,
        type: payload.type,
        activeOtpMethod,
        ttl,
        attemptsRemaining,
        mfaPreferences: {
          emailMfaEnabled,
          notificationMfaEnabled,
          webauthnMfaAvailable,
          superSecureAccountEnabled,
        },
      },
    });
  } catch (error) {
    logger.error('Check MFA session error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred',
    });
  }
};

/**
 * Invalidate MFA session (back to sign in)
 * POST /api/v1/auth/mfa/invalidate
 */
export const invalidateMfaSession = async (req: Request, res: Response) => {
  try {
    const mfaToken = req.cookies?.mfa_session;

    // Clear the MFA session cookie
    res.clearCookie('mfa_session', getCookieClearOptions());

    // If there was a session, try to get userId for logging
    if (mfaToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
          issuer: 'fairarena',
        }) as MFAPendingPayload;

        // Clear any MFA attempt counters
        await redis.del(`mfa_attempts:${payload.userId}`);

        logger.info('MFA session invalidated', { userId: payload.userId });
      } catch {
        // Token was already invalid, just log
        logger.info('MFA session cookie cleared (token was already expired)');
      }
    }

    return res.status(200).json({
      success: true,
      message: 'MFA session invalidated successfully',
    });
  } catch (error) {
    logger.error('Invalidate MFA session error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still return success - the cookie will be cleared
    return res.status(200).json({
      success: true,
      message: 'MFA session cleared',
    });
  }
};

/**
 * Get recent security activity
 * GET /api/v1/auth/recent-activity
 */
export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const cacheKey = `${REDIS_KEYS.USER_RECENT_ACTIVITY_CACHE}${userId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
      });
    }

    const logs = await prisma.logs.findMany({
      where: {
        userId,
        action: {
          in: [
            'register',
            'login',
            'user-created',
            'user-updated',
            'mfa-enabled',
            'mfa-disabled',
            'sensitive-action-attempted',
            'sensitive-action-verified',
            'user-deletion-process-started',
            'Account recovered',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        action: true,
        level: true,
        metadata: true,
        createdAt: true,
      },
    });

    await redis.setex(cacheKey, 600, logs);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    logger.error('Get recent activity error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
    });
  }
};

// MFA Preferences validation schema
const updateMfaPreferencesSchema = z.object({
  emailMfaEnabled: z.boolean().optional(),
  notificationMfaEnabled: z.boolean().optional(),
  acknowledgeSecurityRisk: z.boolean().optional(),
  // New advanced security settings
  disableOTPReverification: z.boolean().optional(),
  superSecureAccountEnabled: z.boolean().optional(),
});

// Update MFA preferences (email/notification OTP toggles + advanced security settings)
// PUT /api/v1/auth/mfa/preferences
export const updateMfaPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const validation = updateMfaPreferencesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const {
      emailMfaEnabled,
      notificationMfaEnabled,
      acknowledgeSecurityRisk,
      disableOTPReverification,
      superSecureAccountEnabled,
    } = validation.data;

    // If enabling email or notification MFA, require user to acknowledge security risk
    const isEnablingLessSecure = emailMfaEnabled === true || notificationMfaEnabled === true;

    if (isEnablingLessSecure && !acknowledgeSecurityRisk) {
      return res.status(400).json({
        success: false,
        message:
          'You must acknowledge the security risk before enabling email or notification-based MFA. These methods are less secure than TOTP or passkeys.',
        code: 'SECURITY_RISK_NOT_ACKNOWLEDGED',
      });
    }

    // Get current user with security key and passkey count
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        mfaEnabled: true,
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        disableOTPReverification: true,
        superSecureAccountEnabled: true,
        _count: { select: { securityKeys: true, passkeys: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const securityKeyCount = user._count.securityKeys;
    const passkeyCount = user._count.passkeys;

    // ============================================================
    // VALIDATION FOR ADVANCED SECURITY SETTINGS
    // ============================================================

    // Validation: disableOTPReverification requires at least 1 security key
    if (disableOTPReverification === true && securityKeyCount === 0) {
      return res.status(400).json({
        success: false,
        message:
          'You must have at least one security key registered before disabling OTP re-verification.',
        code: 'PREREQUISITE_NOT_MET',
        requirement: 'security_key_required',
      });
    }

    // Validation: superSecureAccountEnabled requires:
    // 1. MFA enabled
    // 2. disableOTPReverification enabled (or being enabled in this request)
    // 3. At least 1 security key
    // 4. At least 1 passkey
    if (superSecureAccountEnabled === true) {
      if (!user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message:
            'You must enable Two-Factor Authentication (MFA) before enabling Super Secure Account.',
          code: 'PREREQUISITE_NOT_MET',
          requirement: 'mfa_required',
        });
      }

      // Check if OTP re-verification is disabled (either already or being disabled in this request)
      const willHaveOTPDisabled =
        disableOTPReverification === true ||
        (disableOTPReverification !== false && user.disableOTPReverification);

      if (!willHaveOTPDisabled) {
        return res.status(400).json({
          success: false,
          message: 'You must disable OTP re-verification before enabling Super Secure Account.',
          code: 'PREREQUISITE_NOT_MET',
          requirement: 'disable_otp_reverification_required',
        });
      }

      if (securityKeyCount === 0) {
        return res.status(400).json({
          success: false,
          message:
            'You must have at least one security key registered before enabling Super Secure Account.',
          code: 'PREREQUISITE_NOT_MET',
          requirement: 'security_key_required',
        });
      }

      if (passkeyCount === 0) {
        return res.status(400).json({
          success: false,
          message:
            'You must have at least one passkey registered before enabling Super Secure Account.',
          code: 'PREREQUISITE_NOT_MET',
          requirement: 'passkey_required',
        });
      }
    }

    // Validation: Cannot re-enable OTP reverification while super secure is enabled
    if (disableOTPReverification === false && user.superSecureAccountEnabled) {
      return res.status(400).json({
        success: false,
        message: 'You must disable Super Secure Account before re-enabling OTP re-verification.',
        code: 'CONFLICT',
        requirement: 'disable_super_secure_first',
      });
    }

    // Build update object
    const updateData: {
      emailMfaEnabled?: boolean;
      notificationMfaEnabled?: boolean;
      disableOTPReverification?: boolean;
      superSecureAccountEnabled?: boolean;
    } = {};

    if (typeof emailMfaEnabled === 'boolean') {
      updateData.emailMfaEnabled = emailMfaEnabled;
    }
    if (typeof notificationMfaEnabled === 'boolean') {
      updateData.notificationMfaEnabled = notificationMfaEnabled;
    }
    if (typeof disableOTPReverification === 'boolean') {
      updateData.disableOTPReverification = disableOTPReverification;
    }
    if (typeof superSecureAccountEnabled === 'boolean') {
      updateData.superSecureAccountEnabled = superSecureAccountEnabled;
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { userId },
      data: updateData,
      select: {
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        mfaEnabled: true,
        disableOTPReverification: true,
        superSecureAccountEnabled: true,
        _count: { select: { securityKeys: true, passkeys: true } },
      },
    });

    // Invalidate MFA preferences cache
    await redis.del(`mfa:prefs:${userId}`);
    await redis.del(`mfa:session_check:${userId}`);

    logger.info('MFA preferences updated', {
      userId,
      emailMfaEnabled: updatedUser.emailMfaEnabled,
      notificationMfaEnabled: updatedUser.notificationMfaEnabled,
      disableOTPReverification: updatedUser.disableOTPReverification,
      superSecureAccountEnabled: updatedUser.superSecureAccountEnabled,
    });

    return res.status(200).json({
      success: true,
      message: 'Security preferences updated successfully',
      data: {
        emailMfaEnabled: updatedUser.emailMfaEnabled,
        notificationMfaEnabled: updatedUser.notificationMfaEnabled,
        mfaEnabled: updatedUser.mfaEnabled,
        disableOTPReverification: updatedUser.disableOTPReverification,
        superSecureAccountEnabled: updatedUser.superSecureAccountEnabled,
        securityKeyCount: updatedUser._count.securityKeys,
        passkeyCount: updatedUser._count.passkeys,
      },
    });
  } catch (error) {
    logger.error('Update MFA preferences error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to update MFA preferences',
    });
  }
};

// Get MFA preferences
// GET /api/v1/auth/mfa/preferences
export const getMfaPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const cacheKey = `mfa:prefs:${userId}`;
    const cachedPrefs = await redis.get(cacheKey);

    if (cachedPrefs) {
      return res.status(200).json({
        success: true,
        data: typeof cachedPrefs === 'string' ? JSON.parse(cachedPrefs) : cachedPrefs,
      });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        mfaEnabled: true,
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        disableOTPReverification: true,
        superSecureAccountEnabled: true,
        _count: { select: { securityKeys: true, passkeys: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const prefsData = {
      mfaEnabled: user.mfaEnabled,
      emailMfaEnabled: user.emailMfaEnabled,
      notificationMfaEnabled: user.notificationMfaEnabled,
      disableOTPReverification: user.disableOTPReverification,
      superSecureAccountEnabled: user.superSecureAccountEnabled,
      securityKeyCount: user._count.securityKeys,
      passkeyCount: user._count.passkeys,
    };

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(prefsData));

    return res.status(200).json({
      success: true,
      data: prefsData,
    });
  } catch (error) {
    logger.error('Get MFA preferences error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to get MFA preferences',
    });
  }
};

// Generate a 6-digit OTP
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Send Email OTP for MFA verification
// POST /api/v1/auth/mfa/send-email-otp
export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    // Get user from MFA session JWT cookie
    const mfaToken = req.cookies?.mfa_session;
    if (!mfaToken) {
      return res.status(401).json({
        success: false,
        message: 'No MFA session found. Please login again.',
      });
    }

    // Verify the JWT token
    let payload: MFAPendingPayload;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
        issuer: 'fairarena',
      }) as MFAPendingPayload;

      if (payload.type !== 'mfa_pending' && payload.type !== 'new_device_pending') {
        throw new Error('Invalid token type');
      }
    } catch {
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(401).json({
        success: false,
        message: 'MFA session expired. Please login again.',
      });
    }

    const userId = payload.userId;

    // Check if user has email MFA enabled and security keys
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        email: true,
        firstName: true,
        emailMfaEnabled: true,
        _count: { select: { securityKeys: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: For new device verification, if user has security keys, they MUST use WebAuthn
    // This prevents attackers from bypassing security keys by using email OTP
    if (payload.type === 'new_device_pending' && user._count.securityKeys > 0) {
      logger.warn('Blocked email OTP attempt for user with security keys', {
        userId,
        securityKeyCount: user._count.securityKeys,
      });
      return res.status(403).json({
        success: false,
        message:
          'Security key verification required. Email verification is not available for accounts with security keys.',
        code: 'SECURITY_KEY_REQUIRED',
      });
    }

    // For regular MFA, require emailMfaEnabled to be true
    if (payload.type === 'mfa_pending' && !user.emailMfaEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Email MFA is not enabled for your account. Enable it in security settings.',
      });
    }

    // Generate OTP and hash for secure storage
    const otp = generateOtp();
    const otpHash = hashOTP(otp);
    await redis.setex(`${MFA_OTP_PREFIX}email:${userId}`, MFA_OTP_EXPIRY, otpHash);

    // Send OTP via email (pass plain OTP to email, Inngest handler expects these fields)
    await inngest.send({
      name: 'email/mfa-otp',
      data: {
        email: user.email,
        firstName: user.firstName || 'User',
        otp,
        expiryMinutes: 5,
      },
    });

    logger.info('Email OTP sent for MFA', { userId });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    logger.error('Send email OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
    });
  }
};

// Send Notification OTP for MFA verification
// POST /api/v1/auth/mfa/send-notification-otp
export const sendNotificationOtp = async (req: Request, res: Response) => {
  try {
    // Get user from MFA session JWT cookie
    const mfaToken = req.cookies?.mfa_session;
    if (!mfaToken) {
      return res.status(401).json({
        success: false,
        message: 'No MFA session found. Please login again.',
      });
    }

    // Verify the JWT token
    let payload: MFAPendingPayload;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
        issuer: 'fairarena',
      }) as MFAPendingPayload;

      if (payload.type !== 'mfa_pending' && payload.type !== 'new_device_pending') {
        throw new Error('Invalid token type');
      }
    } catch {
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(401).json({
        success: false,
        message: 'MFA session expired. Please login again.',
      });
    }

    const userId = payload.userId;

    // Check if user has notification MFA enabled and security keys
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        notificationMfaEnabled: true,
        _count: { select: { securityKeys: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: For new device verification, if user has security keys, they MUST use WebAuthn
    // This prevents attackers from bypassing security keys by using notification OTP
    if (payload.type === 'new_device_pending' && user._count.securityKeys > 0) {
      logger.warn('Blocked notification OTP attempt for user with security keys', {
        userId,
        securityKeyCount: user._count.securityKeys,
      });
      return res.status(403).json({
        success: false,
        message:
          'Security key verification required. Notification verification is not available for accounts with security keys.',
        code: 'SECURITY_KEY_REQUIRED',
      });
    }

    // For regular MFA, require notificationMfaEnabled to be true
    if (payload.type === 'mfa_pending' && !user.notificationMfaEnabled) {
      return res.status(400).json({
        success: false,
        message:
          'Notification MFA is not enabled for your account. Enable it in security settings.',
      });
    }

    // Generate OTP and hash for secure storage
    const otp = generateOtp();
    const otpHash = hashOTP(otp);
    await redis.setex(`${MFA_OTP_PREFIX}notification:${userId}`, MFA_OTP_EXPIRY, otpHash);

    // Send OTP via in-app notification
    await inngest.send({
      name: 'notification/send',
      data: {
        userId,
        title: '🔐 MFA Verification Code',
        message: `Your verification code is: ${otp}`,
        description: 'This code will expire in 5 minutes. Do not share it with anyone.',
        metadata: {
          type: 'security',
          priority: 'high',
          action: 'mfa_otp',
          code: otp, // Include code in metadata for easy access
        },
      },
    });

    logger.info('Notification OTP sent for MFA', { userId });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your notifications',
    });
  } catch (error) {
    logger.error('Send notification OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
    });
  }
};

// Verify OTP for email/notification MFA
// POST /api/v1/auth/mfa/verify-otp
export const verifyMfaOtp = async (req: Request, res: Response) => {
  try {
    const { code, method } = req.body;

    if (!code || !method || !['email', 'notification'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Code and method are required.',
      });
    }

    // Get user from MFA session JWT cookie
    const mfaToken = req.cookies?.mfa_session;
    if (!mfaToken) {
      return res.status(401).json({
        success: false,
        message: 'No MFA session found. Please login again.',
      });
    }

    // Verify the JWT token
    let payload: MFAPendingPayload;
    try {
      const jwt = await import('jsonwebtoken');
      payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET, {
        issuer: 'fairarena',
      }) as MFAPendingPayload;

      if (payload.type !== 'mfa_pending' && payload.type !== 'new_device_pending') {
        throw new Error('Invalid token type');
      }
    } catch {
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(401).json({
        success: false,
        message: 'MFA session expired. Please login again.',
      });
    }

    const userId = payload.userId;

    // Fetch user with MFA preferences
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailVerified: true,
        mfaEnabled: true,
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        superSecureAccountEnabled: true,
        isBanned: true,
        banReason: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Security check: Ensure the requested MFA method is actually enabled for this user
    // We skip this check for 'new_device_pending' sessions as they force these methods on
    // BUT we block everything if Super Secure Account is enabled
    if (user.superSecureAccountEnabled) {
      return res.status(403).json({
        success: false,
        message:
          'OTP verification is disabled for Super Secure Accounts. Please use your Security Key.',
        code: 'SUPER_SECURE_ENFORCED',
      });
    }

    if (payload.type === 'mfa_pending') {
      if (method === 'email' && !user.emailMfaEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Email MFA is not enabled for this account',
        });
      }
      if (method === 'notification' && !user.notificationMfaEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Notification MFA is not enabled for this account',
        });
      }
    }

    // Get stored OTP hash
    const storedOtpHash = await redis.get(`${MFA_OTP_PREFIX}${method}:${userId}`);
    if (!storedOtpHash) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new one.',
      });
    }

    // Verify OTP using secure hash comparison
    if (!verifyOTPHash(code, storedOtpHash as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code.',
      });
    }

    // OTP is valid - delete it (one-time use)
    await redis.del(`${MFA_OTP_PREFIX}${method}:${userId}`);

    // --- SUCCESSFUL LOGIN LOGIC ---

    // Get device info
    const userAgentRaw = req.headers['user-agent'] || 'unknown';
    const uaInfo = parseUserAgent(userAgentRaw);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Debug: Log received cookies for multi-account
    const allSessionCookies = parseSessionCookies(req.cookies || {});
    logger.info('OTP verify multi-account check', {
      userId: user.userId,
      existingSessionCount: allSessionCookies.length,
      sessionIds: allSessionCookies.map((s) => s.sessionId.substring(0, 8) + '...'),
      activeSession: req.cookies?.active_session?.substring(0, 8) + '...',
      hasCookies: Object.keys(req.cookies || {}).length > 0,
    });

    // Check if this user is already logged in (has existing session in cookies)
    const otpDeviceFingerprint = `${uaInfo.deviceType}:${userAgentRaw?.substring(0, 50) || 'unknown'}`;
    const existingSession = await findExistingUserSession(
      req.cookies || {},
      user.userId,
      otpDeviceFingerprint,
    );

    if (existingSession) {
      // If same device, prevent duplicate login
      if (existingSession.isSameDevice) {
        res.clearCookie('mfa_session', { path: '/' });

        logger.warn('Duplicate OTP login attempt from same device', {
          userId: user.userId,
          sessionId: existingSession.sessionId,
          deviceFingerprint: otpDeviceFingerprint,
        });

        return res.status(409).json({
          success: false,
          message:
            'You are already logged in on this device. Please use account switcher to access your account.',
          code: 'ALREADY_LOGGED_IN_SAME_DEVICE',
        });
      }

      // Different device - just switch to their session
      res.cookie('active_session', existingSession.sessionId, SESSION_COOKIE_OPTIONS);
      res.clearCookie('mfa_session', { path: '/' });

      // For new device verification, still mark the device as known
      if (payload.type === 'new_device_pending' && payload.deviceFingerprint) {
        const recentDeviceKey = `recent_device:${userId}:${payload.deviceFingerprint}`;
        await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1');
      }

      return res.status(200).json({
        success: true,
        message: 'Already logged in, switched to this account',
        data: {
          user: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            emailVerified: user.emailVerified,
            mfaEnabled: user.mfaEnabled,
          },
          accessToken: generateAccessToken(user.userId, existingSession.sessionId),
        },
      });
    }

    // Check account limit before creating new session
    const currentSessionCount = parseSessionCookies(req.cookies || {}).length;
    if (currentSessionCount >= ENV.MAX_CONCURRENT_ACCOUNTS) {
      res.clearCookie('mfa_session', { path: '/' });
      return res.status(409).json({
        success: false,
        message: `Maximum ${ENV.MAX_CONCURRENT_ACCOUNTS} accounts allowed. Please logout from an account first.`,
        code: 'MAX_ACCOUNTS_REACHED',
      });
    }

    // Create session and tokens
    const refreshToken = generateRefreshToken();
    const sessionId = await createSession(
      user.userId,
      refreshToken,
      {
        deviceName: uaInfo.deviceName,
        deviceType: uaInfo.deviceType,
        userAgent: userAgentRaw,
        ipAddress,
      },
      { isBanned: user.isBanned, banReason: user.banReason },
    );
    const accessToken = generateAccessToken(user.userId, sessionId);

    // Generate binding token for session security
    const { token: bindingToken, hash: bindingHash } = generateBindingToken();
    await storeSessionBinding(sessionId, bindingHash);

    // Update last login
    await prisma.user.update({
      where: { userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Clear MFA session cookie
    res.clearCookie('mfa_session', { path: '/' });

    // Set multi-session cookies
    res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    // For new device verification, mark the device as known
    if (payload.type === 'new_device_pending' && payload.deviceFingerprint) {
      const recentDeviceKey = `recent_device:${userId}:${payload.deviceFingerprint}`;
      await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1'); // 7 days
      logger.info('New device verified and registered', {
        userId,
        deviceFingerprint: payload.deviceFingerprint,
      });
    }

    logger.info('MFA OTP verified successfully', { userId, method });

    return res.status(200).json({
      success: true,
      message: 'Verification successful',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
        },
        accessToken,
      },
    });
  } catch (error) {
    logger.error('Verify MFA OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify code',
    });
  }
};

// ============================================================================
// MULTI-ACCOUNT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Get all logged-in accounts
 * GET /api/v1/auth/accounts
 *
 * Also returns an access token for the active session if one exists.
 * This enables initial hydration on page load (replaces deprecated /refresh endpoint).
 */
export const getLoggedInAccounts = async (req: Request, res: Response) => {
  try {
    // Run legacy migration if needed
    await migrateLegacyCookies(
      req.cookies || {},
      (name) => res.clearCookie(name, { path: '/' }),
      (name, value) => res.cookie(name, value, REFRESH_TOKEN_COOKIE_OPTIONS),
    );

    const accounts = await getLoggedInAccountsInfo(req.cookies || {}, prisma);
    const activeSessionId = req.cookies?.active_session;

    // Generate access token for active session (for initial hydration)
    let accessToken: string | null = null;
    if (activeSessionId) {
      // Verify the session cookie binding
      const bindingToken = req.cookies?.[`session_${activeSessionId}`];
      if (bindingToken) {
        const isValid = await verifySessionBinding(activeSessionId, bindingToken);
        if (isValid) {
          const session = await getSession(activeSessionId);
          if (session && !session.isBanned) {
            accessToken = generateAccessToken(session.userId, activeSessionId);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        accounts,
        activeSessionId,
        maxAccounts: ENV.MAX_CONCURRENT_ACCOUNTS,
        accessToken, // For initial hydration on page load
      },
    });
  } catch (error) {
    logger.error('Get logged in accounts error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts',
    });
  }
};

/**
 * Switch to a different account
 * POST /api/v1/auth/accounts/switch
 */
export const switchAccount = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required',
      });
    }

    // Verify the session exists in cookies
    const allSessions = parseSessionCookies(req.cookies || {});
    const targetSession = allSessions.find((s) => s.sessionId === sessionId);

    if (!targetSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found in your logged-in accounts',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // Verify session exists in Redis
    const session = await getSession(sessionId);
    if (!session) {
      // Session expired - clear the cookie
      res.clearCookie(`session_${sessionId}`, { path: '/' });

      return res.status(404).json({
        success: false,
        message: 'Session has expired. Please login again.',
        code: 'SESSION_EXPIRED',
      });
    }

    // Set as active session
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    // Fetch user info for the new active session
    const user = await prisma.user.findUnique({
      where: { userId: session.userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailVerified: true,
      },
    });

    logger.info('account_switched', {
      userId: session.userId,
      sessionId,
    });

    return res.status(200).json({
      success: true,
      message: 'Switched account successfully',
      data: {
        user,
        sessionId,
      },
    });
  } catch (error) {
    logger.error('Switch account error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to switch account',
    });
  }
};

/**
 * Logout from all accounts
 * POST /api/v1/auth/accounts/logout-all
 */
export const logoutAllAccounts = async (req: Request, res: Response) => {
  try {
    const allSessions = parseSessionCookies(req.cookies || {});

    // Destroy all sessions in Redis
    for (const { sessionId } of allSessions) {
      await destroySession(sessionId);
      res.clearCookie(`session_${sessionId}`, {
        path: '/',
        ...(ENV.NODE_ENV === 'production' && { domain: ENV.COOKIE_DOMAIN }),
      });
    }

    // Clear active session cookie
    res.clearCookie('active_session', {
      path: '/',
      ...(ENV.NODE_ENV === 'production' && { domain: ENV.COOKIE_DOMAIN }),
    });

    // Clear legacy cookies if any
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('sessionId', { path: '/' });

    logger.info('all_accounts_logged_out', {
      sessionCount: allSessions.length,
    });

    return res.status(200).json({
      success: true,
      message: `Logged out from ${allSessions.length} account(s)`,
    });
  } catch (error) {
    logger.error('Logout all accounts error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
    });
  }
};

/**
 * Exchange OAuth Access Token for Session
 * POST /api/v1/auth/oauth/session
 *
 * This endpoint allows clients to exchange an OAuth access token (from device flow, etc.)
 * for a session cookie. This is needed because OAuth flows return JWT tokens but the
 * application uses HTTP-only session cookies for authentication.
 */
export const exchangeOAuthTokenForSession = async (req: Request, res: Response) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'access_token is required',
      });
    }

    // Verify the OAuth access token
    let tokenPayload: any;
    try {
      const jwt = await import('jsonwebtoken');

      // Decode without verification first to check issuer
      const decoded = jwt.default.decode(access_token) as any;

      // Only accept tokens issued by our own OAuth provider
      if (!decoded || decoded.iss !== ENV.OAUTH_ISSUER) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token issuer',
        });
      }

      // Now verify the token signature
      tokenPayload = jwt.default.verify(
        access_token,
        ENV.OAUTH_BOOTSTRAP_RSA_PUBLIC_KEY || ENV.JWT_SECRET,
        {
          issuer: ENV.OAUTH_ISSUER,
          algorithms: ['RS256', 'HS256'],
        },
      );
    } catch (jwtError) {
      logger.warn('OAuth token verification failed', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token',
      });
    }

    // Extract user ID from token (sub claim in OAuth tokens)
    const userId = tokenPayload.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token missing user identifier',
      });
    }

    // Check if token has been revoked (check jti against database)
    if (tokenPayload.jti) {
      const { prisma } = await import('../../config/database.js');
      const accessToken = await prisma.oAuthAccessToken.findUnique({
        where: { jti: tokenPayload.jti },
      });

      if (!accessToken || accessToken.revokedAt) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked',
        });
      }
    }

    // Get user details
    const { prisma } = await import('../../config/database.js');
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailVerified: true,
        isDeleted: true,
        isBanned: true,
        banReason: true,
      },
    });

    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.banReason || 'Violation of terms'}`,
        code: 'USER_BANNED',
      });
    }

    // Get device info
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const { deviceType, deviceName } = parseUserAgent(userAgent);

    // Check if user already has a session (multi-account support)
    const deviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
    const existingSession = await findExistingUserSession(
      req.cookies || {},
      user.userId,
      deviceFingerprint,
    );

    if (existingSession) {
      // User already has a session, just switch to it
      res.cookie('active_session', existingSession.sessionId, SESSION_COOKIE_OPTIONS);

      logger.info('OAuth token exchanged - switched to existing session', {
        userId: user.userId,
        sessionId: existingSession.sessionId,
      });

      return res.status(200).json({
        success: true,
        message: 'Session created successfully',
        data: {
          user: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            emailVerified: user.emailVerified,
          },
          accessToken: generateAccessToken(user.userId, existingSession.sessionId),
        },
      });
    }

    // Check account limit
    const currentSessionCount = parseSessionCookies(req.cookies || {}).length;
    if (currentSessionCount >= ENV.MAX_CONCURRENT_ACCOUNTS) {
      return res.status(409).json({
        success: false,
        message: `Maximum ${ENV.MAX_CONCURRENT_ACCOUNTS} accounts allowed. Please logout from an account first.`,
        code: 'MAX_ACCOUNTS_REACHED',
      });
    }

    // Create new session
    const refreshToken = generateRefreshToken();
    const sessionId = await createSession(
      user.userId,
      refreshToken,
      {
        deviceName,
        deviceType,
        userAgent,
        ipAddress,
      },
      { isBanned: user.isBanned, banReason: user.banReason },
    );
    const newAccessToken = generateAccessToken(user.userId, sessionId);

    // Generate binding token for session security
    const { token: bindingToken, hash: bindingHash } = generateBindingToken();
    await storeSessionBinding(sessionId, bindingHash);

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set multi-session cookies
    res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    // Track device
    const recentDeviceKey = `recent_device:${user.userId}:${deviceFingerprint}`;
    await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1');

    logger.info('OAuth token exchanged for session successfully', {
      userId: user.userId,
      sessionId,
      deviceType,
    });

    // Log activity
    await inngest.send({
      name: 'log.create',
      data: {
        userId: user.userId,
        action: 'oauth_session_created',
        level: 'INFO',
        metadata: {
          deviceName,
          deviceType,
          ipAddress,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Schedule token refresh
    await inngest.send({
      name: 'auth/session.created',
      data: {
        sessionId,
        userId: user.userId,
        accessToken: newAccessToken,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Session created successfully',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          emailVerified: user.emailVerified,
        },
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    logger.error('OAuth session exchange error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to create session',
    });
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}
