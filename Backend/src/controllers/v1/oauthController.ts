import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import {
    createSession,
    generateAccessToken,
    generateRefreshToken,
    parseUserAgent,
} from '../../services/auth.service.js';
import logger from '../../utils/logger.js';

// Google OAuth client
const googleClient = new OAuth2Client(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_CALLBACK_URL,
);

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

// Validation schema for Google token
const googleAuthSchema = z.object({
    credential: z.string().min(1, 'Google credential is required'),
});

/**
 * Generate Google OAuth URL for redirect-based flow
 * GET /api/v1/auth/google
 */
export const getGoogleAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['openid', 'email', 'profile'],
            prompt: 'select_account',
            state: req.query.redirect as string || '/dashboard',
        });

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Google auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Google authentication',
        });
    }
};

/**
 * Handle Google OAuth callback
 * GET /api/v1/auth/google/callback
 */
export const handleGoogleCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=google_auth_failed`);
        }

        // Exchange code for tokens
        const { tokens } = await googleClient.getToken(code);

        if (!tokens.id_token) {
            logger.error('No ID token received from Google');
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=google_auth_failed`);
        }

        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: ENV.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            logger.error('Invalid Google token payload');
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=google_auth_failed`);
        }

        const { email, sub: googleId, given_name, family_name, picture } = payload;

        // Find or create user
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email: email.toLowerCase() },
                ],
            },
        });

        if (!user) {
            // Create new user
            const { createId } = await import('@paralleldrive/cuid2');
            const userId = createId();

            user = await prisma.user.create({
                data: {
                    userId,
                    email: email.toLowerCase(),
                    googleId,
                    firstName: given_name || null,
                    lastName: family_name || null,
                    profileImageUrl: picture || null,
                    emailVerified: true, // Google emails are verified
                },
            });

            logger.info('New user created via Google OAuth', { userId: user.userId, email: user.email });
        } else if (!user.googleId) {
            // Link Google account to existing user
            await prisma.user.update({
                where: { userId: user.userId },
                data: {
                    googleId,
                    profileImageUrl: user.profileImageUrl || picture || null,
                    emailVerified: true,
                },
            });

            logger.info('Google account linked to existing user', { userId: user.userId });
        }

        // Get device info
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const { deviceType, deviceName } = parseUserAgent(userAgent);

        // Create session and tokens
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

        // Redirect to frontend with access token
        const redirectUrl = (state as string) || '/dashboard';
        const frontendUrl = `${ENV.FRONTEND_URL}${redirectUrl}?token=${accessToken}`;

        logger.info('User logged in via Google OAuth', { userId: user.userId, deviceType });

        return res.redirect(frontendUrl);
    } catch (error) {
        logger.error('Google OAuth callback error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=google_auth_failed`);
    }
};

/**
 * Handle Google One Tap / ID Token authentication (frontend)
 * POST /api/v1/auth/google/token
 */
export const handleGoogleToken = async (req: Request, res: Response) => {
    try {
        const validation = googleAuthSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        const { credential } = validation.data;

        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: ENV.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Google token',
            });
        }

        const { email, sub: googleId, given_name, family_name, picture } = payload;

        // Find or create user
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email: email.toLowerCase() },
                ],
            },
        });

        let isNewUser = false;

        if (!user) {
            // Create new user
            const { createId } = await import('@paralleldrive/cuid2');
            const userId = createId();

            user = await prisma.user.create({
                data: {
                    userId,
                    email: email.toLowerCase(),
                    googleId,
                    firstName: given_name || null,
                    lastName: family_name || null,
                    profileImageUrl: picture || null,
                    emailVerified: true,
                },
            });

            isNewUser = true;
            logger.info('New user created via Google One Tap', { userId: user.userId, email: user.email });
        } else if (!user.googleId) {
            // Link Google account to existing user
            await prisma.user.update({
                where: { userId: user.userId },
                data: {
                    googleId,
                    profileImageUrl: user.profileImageUrl || picture || null,
                    emailVerified: true,
                },
            });

            logger.info('Google account linked to existing user', { userId: user.userId });
        }

        // Get device info
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const { deviceType, deviceName } = parseUserAgent(userAgent);

        // Create session and tokens
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

        logger.info('User logged in via Google token', { userId: user.userId, deviceType });

        return res.status(200).json({
            success: true,
            message: isNewUser ? 'Account created successfully' : 'Login successful',
            data: {
                accessToken,
                user: {
                    userId: user.userId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    profileImageUrl: user.profileImageUrl,
                },
                isNewUser,
            },
        });
    } catch (error) {
        logger.error('Google token auth error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Google authentication failed',
        });
    }
};
