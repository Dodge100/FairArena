import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis } from '../../config/redis.js';
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
    verifyPasswordResetToken
} from '../../services/auth.service.js';
import logger from '../../utils/logger.js';

// Validation Schemas
const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
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

// Cookie configuration
const REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
};

const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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

        // Find user
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
            },
        });

        if (!user || user.isDeleted) {
            await recordFailedLogin(normalizedEmail);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
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

        // Clear failed login attempts
        await clearFailedLogins(normalizedEmail);

        // Get device info
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const { deviceType, deviceName } = parseUserAgent(userAgent);

        // Generate tokens
        const refreshToken = generateRefreshToken();
        const sessionId = await createSession(user.userId, refreshToken, {
            deviceName,
            deviceType,
            userAgent,
            ipAddress,
        });
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

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
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
