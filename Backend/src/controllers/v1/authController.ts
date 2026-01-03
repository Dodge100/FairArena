import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
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
  generateAccessToken,
  generateRefreshToken,
  getUserSessions,
  hashPassword,
  invalidatePasswordResetToken,
  isLockedOut,
  parseUserAgent,
  recordFailedLogin,
  rotateRefreshToken,
  validatePasswordStrength,
  verifyEmailVerificationToken,
  verifyPassword,
  verifyPasswordResetToken,
} from '../../services/auth.service.js';
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

const verifyMfaOtpSchema = z.object({
  code: z.string().length(6, 'OTP must be 6 digits'),
  method: z.enum(['email', 'notification']).optional(),
});

// Cryptographically secure OTP generation
const generateOTP = (): string => {
  // Generate cryptographically random 6-digit OTP
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // Ensure 6 digits (100000 to 999999)
  return String(100000 + (randomNumber % 900000));
};

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



// Cookie configuration
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

const MFA_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 5 * 60 * 1000, // 5 minutes
  path: '/',
};

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

    const { email, password, firstName, lastName } = validation.data;

    // Check if email domain is allowed (if ALLOWED_SIGNUP_DOMAINS is set)
    if (ENV.ALLOWED_SIGNUP_DOMAINS && ENV.ALLOWED_SIGNUP_DOMAINS.trim() !== '') {
      const allowedDomains = ENV.ALLOWED_SIGNUP_DOMAINS.split(',').map(d => d.trim().toLowerCase());
      const emailDomain = email.toLowerCase().split('@')[1];

      if (!allowedDomains.includes(emailDomain) && !ENV.NEW_SIGNUP_ENABLED) {
        return res.status(403).json({
          success: false,
          message: 'Registration is currently restricted to authorized organizations.',
          code: 'EMAIL_DOMAIN_NOT_ALLOWED',
        });
      }
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
        // Check if user has any registered security keys
        _count: {
          select: { securityKeys: true }
        }
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
    if (user.mfaEnabled) {
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

    if (!isKnownDevice) {

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

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set cookies
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);

    // Check if this is a new device login (simple check: no login from this device type in last 7 days)
    const deviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
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
      res.clearCookie('mfa_session', { path: '/' });
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
      res.clearCookie('mfa_session', { path: '/' });
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
        mfaSecret: true,
        mfaBackupCodes: true,
        mfaEnabled: true,
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

        logger.info('Backup code usage alert sent', { userId, remainingCodes: updatedCodes.length });
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

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set cookies
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);

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


    // Clear MFA session cookie on successful login
    res.clearCookie('mfa_session', { path: '/' });

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
    const refreshToken = req.cookies?.refreshToken;
    const sessionId = req.cookies?.sessionId;

    if (!refreshToken || !sessionId) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    // Rotate refresh token (get new tokens)
    const result = await rotateRefreshToken(sessionId, refreshToken);

    if (!result) {
      // Clear invalid cookies
      res.clearCookie('refreshToken', { path: '/' });
      res.clearCookie('sessionId', { path: '/' });

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Set new refresh token cookie
    res.cookie('refreshToken', result.newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

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
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (sessionId) {
      await destroySession(sessionId);
    }

    // Clear cookies
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('sessionId', { path: '/' });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still clear cookies even on error
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('sessionId', { path: '/' });

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

    await destroySession(sessionId);

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
    const prefsCacheKey = `mfa:prefs:${payload.userId}`;
    const cachedPrefs = await redis.get(prefsCacheKey);

    let emailMfaEnabled = false;
    let notificationMfaEnabled = false;
    let webauthnMfaAvailable = false;

    if (cachedPrefs) {
      const prefs = typeof cachedPrefs === 'string' ? JSON.parse(cachedPrefs) : cachedPrefs;
      emailMfaEnabled = prefs.emailMfaEnabled || false;
      notificationMfaEnabled = prefs.notificationMfaEnabled || false;
      webauthnMfaAvailable = prefs.webauthnMfaAvailable || false;
    } else {
      const user = await prisma.user.findUnique({
        where: { userId: payload.userId },
        select: {
          mfaEnabled: true,
          emailMfaEnabled: true,
          notificationMfaEnabled: true,
          _count: {
            select: { securityKeys: true }
          }
        },
      });

      emailMfaEnabled = user?.emailMfaEnabled || false;
      notificationMfaEnabled = user?.notificationMfaEnabled || false;
      webauthnMfaAvailable = (user?._count?.securityKeys || 0) > 0;

      // Cache for 1 hour to match getMfaPreferences
      if (user) {
        await redis.setex(prefsCacheKey, 3600, JSON.stringify({
          mfaEnabled: user.mfaEnabled,
          emailMfaEnabled,
          notificationMfaEnabled,
          webauthnMfaAvailable
        }));
      }
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
    res.clearCookie('mfa_session', {
      path: '/',
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
    });

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
});

// Update MFA preferences (email/notification OTP toggles)
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

    const { emailMfaEnabled, notificationMfaEnabled, acknowledgeSecurityRisk } = validation.data;

    // If enabling email or notification MFA, require user to acknowledge security risk
    const isEnablingLessSecure =
      (emailMfaEnabled === true) || (notificationMfaEnabled === true);

    if (isEnablingLessSecure && !acknowledgeSecurityRisk) {
      return res.status(400).json({
        success: false,
        message: 'You must acknowledge the security risk before enabling email or notification-based MFA. These methods are less secure than TOTP or passkeys.',
        code: 'SECURITY_RISK_NOT_ACKNOWLEDGED',
      });
    }

    // Get current user to check MFA status
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        mfaEnabled: true,
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Build update object
    const updateData: { emailMfaEnabled?: boolean; notificationMfaEnabled?: boolean } = {};
    if (typeof emailMfaEnabled === 'boolean') {
      updateData.emailMfaEnabled = emailMfaEnabled;
    }
    if (typeof notificationMfaEnabled === 'boolean') {
      updateData.notificationMfaEnabled = notificationMfaEnabled;
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { userId },
      data: updateData,
      select: {
        emailMfaEnabled: true,
        notificationMfaEnabled: true,
        mfaEnabled: true,
      },
    });

    // Invalidate MFA preferences cache
    await redis.del(`mfa:prefs:${userId}`);

    logger.info('MFA preferences updated', {
      userId,
      emailMfaEnabled: updatedUser.emailMfaEnabled,
      notificationMfaEnabled: updatedUser.notificationMfaEnabled,
    });

    return res.status(200).json({
      success: true,
      message: 'MFA preferences updated successfully',
      data: {
        emailMfaEnabled: updatedUser.emailMfaEnabled,
        notificationMfaEnabled: updatedUser.notificationMfaEnabled,
        mfaEnabled: updatedUser.mfaEnabled,
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
        _count: { select: { securityKeys: true } }
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
        message: 'Security key verification required. Email verification is not available for accounts with security keys.',
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
        _count: { select: { securityKeys: true } }
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
        message: 'Security key verification required. Notification verification is not available for accounts with security keys.',
        code: 'SECURITY_KEY_REQUIRED',
      });
    }

    // For regular MFA, require notificationMfaEnabled to be true
    if (payload.type === 'mfa_pending' && !user.notificationMfaEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Notification MFA is not enabled for your account. Enable it in security settings.',
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
      { isBanned: user.isBanned, banReason: user.banReason }
    );
    const accessToken = generateAccessToken(user.userId, sessionId);

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

    // Set auth cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // For new device verification, mark the device as known
    if (payload.type === 'new_device_pending' && payload.deviceFingerprint) {
      const recentDeviceKey = `recent_device:${userId}:${payload.deviceFingerprint}`;
      await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1'); // 7 days
      logger.info('New device verified and registered', { userId, deviceFingerprint: payload.deviceFingerprint });
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
