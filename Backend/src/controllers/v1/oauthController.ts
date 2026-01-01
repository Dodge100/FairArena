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

const MFA_SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 5 * 60 * 1000, // 5 minutes
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

        // Check for MFA
        if (user.mfaEnabled) {
            // Get IP and device fingerprint for security
            const ipAddress =
                (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                req.ip ||
                req.socket.remoteAddress ||
                'unknown';
            const deviceFingerprint = req.headers['user-agent'] || 'unknown';

            const tempToken = await import('jsonwebtoken').then(jwt =>
                jwt.default.sign(
                    {
                        userId: user.userId,
                        type: 'mfa_pending',
                        ipAddress,
                        deviceFingerprint,
                    },
                    ENV.JWT_SECRET,
                    { expiresIn: '5m', issuer: 'fairarena' }
                )
            );

            // Set MFA session cookie (HTTP-only, secure)
            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

            // Store the redirect target in a separate cookie
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false, // Frontend needs to read this
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'lax' as const,
                maxAge: 5 * 60 * 1000, // 5 minutes
                path: '/',
            });

            // Redirect to signin page - frontend will detect the MFA cookie
            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
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
    }
    catch (error) {
        logger.error('Failed to handle Google callback', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to handle Google callback',
        });
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

        // Check for MFA
        if (user.mfaEnabled) {
            // Get IP and device fingerprint for security
            const ipAddress =
                (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                req.ip ||
                req.socket.remoteAddress ||
                'unknown';
            const deviceFingerprint = req.headers['user-agent'] || 'unknown';

            const tempToken = await import('jsonwebtoken').then(jwt =>
                jwt.default.sign(
                    {
                        userId: user.userId,
                        type: 'mfa_pending',
                        ipAddress,
                        deviceFingerprint,
                    },
                    ENV.JWT_SECRET,
                    { expiresIn: '5m', issuer: 'fairarena' }
                )
            );

            // Set MFA session cookie (HTTP-only, secure)
            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

            return res.status(200).json({
                success: true,
                message: 'MFA verification required',
                mfaRequired: true,
                // No tempToken in response - it's in the cookie
            });
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
}

export const getGithubAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://github.com/login/oauth/authorize';
        const options = {
            client_id: ENV.GITHUB_CLIENT_ID,
            redirect_uri: ENV.GITHUB_CALLBACK_URL,
            scope: 'user:email read:user',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate GitHub auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate GitHub authentication',
        });
    }
};

interface GithubUser {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
}

interface GithubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
    visibility: string | null;
}

/**
 * Handle GitHub OAuth callback
 * GET /api/v1/auth/github/callback
 */
export const handleGithubCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=github_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: ENV.GITHUB_CLIENT_ID,
                client_secret: ENV.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: ENV.GITHUB_CALLBACK_URL,
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve GitHub access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=github_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user profile
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch GitHub user');
        }

        const githubUser = await userResponse.json() as GithubUser;
        let email = githubUser.email;

        // If email is private, fetch it separately
        if (!email) {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (emailResponse.ok) {
                const emails = await emailResponse.json() as GithubEmail[];
                const primaryEmail = emails.find(e => e.primary && e.verified);
                if (primaryEmail) {
                    email = primaryEmail.email;
                }
            }
        }

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=github_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email as string },
            });

            if (!user) {
                // Create new user
                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email as string,
                        profileImageUrl: githubUser.avatar_url,
                        firstName: githubUser.name?.split(' ')[0] || githubUser.login,
                        lastName: githubUser.name?.split(' ').slice(1).join(' ') || '',
                        emailVerified: true,
                    },
                });
            } else if (!user.profileImageUrl && githubUser.avatar_url) {
                // Update avatar if missing
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: githubUser.avatar_url },
                });
            }

            return user;
        }, {
            maxWait: 5000, // Wait max 5s for connection
            timeout: 10000, // Transaction can run for 10s
        });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const mfaType = 'mfa_pending';
            const jwt = await import('jsonwebtoken');

            // Create temporary MFA session token
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: mfaType,
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            // Set MFA session cookie (HTTP-only, secure)
            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

            // Store the redirect target in a separate cookie
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false, // Frontend needs to read this
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'lax' as const,
                maxAge: 5 * 60 * 1000, // 5 minutes
                path: '/',
            });

            // Redirect to signin page - frontend will detect the MFA cookie
            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens
        const refreshToken = generateRefreshToken();

        // Get device info
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);

        // Create Session
        const sessionId = await createSession(
            transaction.userId,
            refreshToken,
            {
                deviceName: userAgent.deviceName,
                deviceType: userAgent.deviceType,
                userAgent: userAgentRaw,
                ipAddress: req.ip || 'unknown'
            }
        );

        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        // Set cookies
        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);


        // Clear any MFA cookies if they exist
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        // Redirect to dashboard
        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        logger.error('GitHub auth error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};
