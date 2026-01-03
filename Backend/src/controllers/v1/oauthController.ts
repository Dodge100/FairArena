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
            // Check if signups are enabled
            if (!ENV.NEW_SIGNUP_ENABLED) {
                return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
            }

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
                sameSite: 'strict' as const,
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
            // Check if signups are enabled
            if (!ENV.NEW_SIGNUP_ENABLED) {
                return res.status(403).json({
                    success: false,
                    message: 'Signups are currently disabled. Please join our waitlist.',
                    code: 'SIGNUP_DISABLED',
                });
            }

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
                // Check if signups are enabled
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

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
                sameSite: 'strict' as const,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }

        logger.error('GitHub auth error', {
            error: errorMessage,
        });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

/**
 * Generate Microsoft OAuth URL
 * GET /api/v1/auth/microsoft
 */
export const getMicrosoftAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
        const options = {
            client_id: ENV.MICROSOFT_CLIENT_ID,
            redirect_uri: ENV.MICROSOFT_CALLBACK_URL,
            response_type: 'code',
            response_mode: 'query',
            scope: 'openid profile email User.Read',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options as any).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Microsoft auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Microsoft authentication',
        });
    }
};

interface MicrosoftUser {
    id: string;
    displayName?: string;
    givenName?: string;
    surname?: string;
    userPrincipalName?: string;
    mail?: string;
}

/**
 * Handle Microsoft OAuth callback
 * GET /api/v1/auth/microsoft/callback
 */
export const handleMicrosoftCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=microsoft_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: ENV.MICROSOFT_CLIENT_ID,
                scope: 'openid profile email User.Read',
                code,
                redirect_uri: ENV.MICROSOFT_CALLBACK_URL || '',
                grant_type: 'authorization_code',
                client_secret: ENV.MICROSOFT_CLIENT_SECRET,
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve Microsoft access token', {
                error: tokenData.error,
                description: tokenData.error_description
            });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=microsoft_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user profile
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch Microsoft user');
        }

        const msUser = await userResponse.json() as MicrosoftUser;

        // Prefer mail, fallback to UserPrincipalName
        const email = msUser.mail || msUser.userPrincipalName;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=microsoft_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                // Check if signups are enabled
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                // Create new user
                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        firstName: msUser.givenName || msUser.displayName?.split(' ')[0] || null,
                        lastName: msUser.surname || msUser.displayName?.split(' ').slice(1).join(' ') || null,
                        emailVerified: true, // Microsoft emails are generally considered verified if we got this far
                    },
                });
            }

            return user;
        }, {
            maxWait: 5000,
            timeout: 10000,
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
                sameSite: 'strict' as const,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }

        logger.error('Microsoft auth error', {
            error: errorMessage,
        });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

// =====================================================
// DISCORD OAUTH
// =====================================================

/**
 * Generate Discord OAuth URL
 * GET /api/v1/auth/discord
 */
export const getDiscordAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://discord.com/api/oauth2/authorize';
        const options = {
            client_id: ENV.DISCORD_CLIENT_ID,
            redirect_uri: ENV.DISCORD_CALLBACK_URL || '',
            response_type: 'code',
            scope: 'identify email',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Discord auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Discord authentication',
        });
    }
};

interface DiscordUser {
    id: string;
    username: string;
    email?: string;
    avatar?: string;
    global_name?: string;
}

/**
 * Handle Discord OAuth callback
 * GET /api/v1/auth/discord/callback
 */
export const handleDiscordCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=discord_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: ENV.DISCORD_CLIENT_ID,
                client_secret: ENV.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: ENV.DISCORD_CALLBACK_URL || '',
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve Discord access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=discord_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user profile
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch Discord user');
        }

        const discordUser = await userResponse.json() as DiscordUser;
        const email = discordUser.email;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=discord_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                const avatarUrl = discordUser.avatar
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                    : null;

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: avatarUrl,
                        firstName: discordUser.global_name || discordUser.username,
                        lastName: '',
                        emailVerified: true,
                    },
                });
            } else if (!user.profileImageUrl && discordUser.avatar) {
                const avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: avatarUrl },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('Discord auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

// =====================================================
// HUGGING FACE OAUTH
// =====================================================

/**
 * Generate Hugging Face OAuth URL
 * GET /api/v1/auth/huggingface
 */
export const getHuggingFaceAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://huggingface.co/oauth/authorize';
        const options = {
            client_id: ENV.HUGGINGFACE_CLIENT_ID,
            redirect_uri: ENV.HUGGINGFACE_CALLBACK_URL || '',
            response_type: 'code',
            scope: 'openid profile email',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Hugging Face auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Hugging Face authentication',
        });
    }
};

interface HuggingFaceUser {
    sub: string;
    name?: string;
    preferred_username?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
}

/**
 * Handle Hugging Face OAuth callback
 * GET /api/v1/auth/huggingface/callback
 */
export const handleHuggingFaceCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=huggingface_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://huggingface.co/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: ENV.HUGGINGFACE_CLIENT_ID,
                client_secret: ENV.HUGGINGFACE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: ENV.HUGGINGFACE_CALLBACK_URL || '',
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve Hugging Face access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=huggingface_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user info using OpenID Connect userinfo endpoint
        const userResponse = await fetch('https://huggingface.co/oauth/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch Hugging Face user');
        }

        const hfUser = await userResponse.json() as HuggingFaceUser;
        const email = hfUser.email;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=huggingface_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: hfUser.picture || null,
                        firstName: hfUser.name?.split(' ')[0] || hfUser.preferred_username || null,
                        lastName: hfUser.name?.split(' ').slice(1).join(' ') || null,
                        emailVerified: hfUser.email_verified || true,
                    },
                });
            } else if (!user.profileImageUrl && hfUser.picture) {
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: hfUser.picture },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('Hugging Face auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};


// =====================================================
// GITLAB OAUTH
// =====================================================

/**
 * Generate GitLab OAuth URL
 * GET /api/v1/auth/gitlab
 */
export const getGitLabAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://gitlab.com/oauth/authorize';
        const options = {
            client_id: ENV.GITLAB_CLIENT_ID,
            redirect_uri: ENV.GITLAB_CALLBACK_URL || '',
            response_type: 'code',
            scope: 'read_user email',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate GitLab auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate GitLab authentication',
        });
    }
};

interface GitLabUser {
    id: number;
    username: string;
    email: string;
    name: string;
    avatar_url: string;
}

/**
 * Handle GitLab OAuth callback
 * GET /api/v1/auth/gitlab/callback
 */
export const handleGitLabCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=gitlab_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://gitlab.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: ENV.GITLAB_CLIENT_ID,
                client_secret: ENV.GITLAB_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: ENV.GITLAB_CALLBACK_URL || '',
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve GitLab access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=gitlab_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user profile
        const userResponse = await fetch('https://gitlab.com/api/v4/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch GitLab user');
        }

        const gitlabUser = await userResponse.json() as GitLabUser;
        const email = gitlabUser.email;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=gitlab_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: gitlabUser.avatar_url || null,
                        firstName: gitlabUser.name?.split(' ')[0] || gitlabUser.username,
                        lastName: gitlabUser.name?.split(' ').slice(1).join(' ') || '',
                        emailVerified: true,
                    },
                });
            } else if (!user.profileImageUrl && gitlabUser.avatar_url) {
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: gitlabUser.avatar_url },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('GitLab auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

// =====================================================
// SLACK OAUTH
// =====================================================

/**
 * Generate Slack OAuth URL
 * GET /api/v1/auth/slack
 */
export const getSlackAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://slack.com/oauth/v2/authorize';
        const options = {
            client_id: ENV.SLACK_CLIENT_ID,
            redirect_uri: ENV.SLACK_CALLBACK_URL || '',
            scope: '',
            user_scope: 'identity.basic,identity.email,identity.avatar',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Slack auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Slack authentication',
        });
    }
};

interface SlackUser {
    user: {
        id: string;
        name: string;
        email: string;
        image_512?: string;
        image_192?: string;
        image_72?: string;
    };
}

/**
 * Handle Slack OAuth callback
 * GET /api/v1/auth/slack/callback
 */
export const handleSlackCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=slack_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: ENV.SLACK_CLIENT_ID,
                client_secret: ENV.SLACK_CLIENT_SECRET,
                code,
                redirect_uri: ENV.SLACK_CALLBACK_URL || '',
            }),
        });

        const tokenData = await tokenResponse.json() as {
            ok: boolean;
            authed_user?: { access_token?: string };
            error?: string;
        };

        if (!tokenResponse.ok || !tokenData.ok || !tokenData.authed_user?.access_token) {
            logger.error('Failed to retrieve Slack access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=slack_token_failed`);
        }

        const accessToken = tokenData.authed_user.access_token;

        // Get user identity
        const userResponse = await fetch('https://slack.com/api/users.identity', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userData = await userResponse.json() as { ok: boolean; error?: string } & SlackUser;

        if (!userResponse.ok || !userData.ok) {
            throw new Error('Failed to fetch Slack user');
        }

        const email = userData.user.email;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=slack_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                const avatarUrl = userData.user.image_512 || userData.user.image_192 || userData.user.image_72 || null;
                const nameParts = userData.user.name?.split(' ') || [];

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: avatarUrl,
                        firstName: nameParts[0] || null,
                        lastName: nameParts.slice(1).join(' ') || null,
                        emailVerified: true,
                    },
                });
            } else if (!user.profileImageUrl && userData.user.image_512) {
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: userData.user.image_512 },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('Slack auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

// =====================================================
// NOTION OAUTH
// =====================================================

/**
 * Generate Notion OAuth URL
 * GET /api/v1/auth/notion
 */
export const getNotionAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://api.notion.com/v1/oauth/authorize';
        const options = {
            client_id: ENV.NOTION_CLIENT_ID,
            redirect_uri: ENV.NOTION_CALLBACK_URL || '',
            response_type: 'code',
            owner: 'user',
            state: req.query.redirect as string || '/dashboard',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate Notion auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate Notion authentication',
        });
    }
};

interface NotionUser {
    object: 'user';
    id: string;
    name: string | null;
    avatar_url: string | null;
    type: 'person' | 'bot';
    person?: {
        email: string;
    };
}

/**
 * Handle Notion OAuth callback
 * GET /api/v1/auth/notion/callback
 */
export const handleNotionCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=notion_auth_failed`);
        }

        // Exchange code for access token
        const authString = Buffer.from(`${ENV.NOTION_CLIENT_ID}:${ENV.NOTION_CLIENT_SECRET}`).toString('base64');
        const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${authString}`,
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                redirect_uri: ENV.NOTION_CALLBACK_URL || '',
            }),
        });

        const tokenData = await tokenResponse.json() as {
            access_token?: string;
            owner?: NotionUser;
            error?: string;
        };

        if (!tokenResponse.ok || !tokenData.access_token || !tokenData.owner) {
            logger.error('Failed to retrieve Notion access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=notion_token_failed`);
        }

        const notionUser = tokenData.owner;
        const email = notionUser.person?.email;

        if (!email) {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=notion_email_missing`);
        }

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                const nameParts = notionUser.name?.split(' ') || [];

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: notionUser.avatar_url,
                        firstName: nameParts[0] || null,
                        lastName: nameParts.slice(1).join(' ') || null,
                        emailVerified: true,
                    },
                });
            } else if (!user.profileImageUrl && notionUser.avatar_url) {
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: notionUser.avatar_url },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('Notion auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};

// =====================================================
// X (TWITTER) OAUTH
// =====================================================

/**
 * Generate X OAuth URL
 * GET /api/v1/auth/x
 */
export const getXAuthUrl = async (req: Request, res: Response) => {
    try {
        const rootUrl = 'https://twitter.com/i/oauth2/authorize';
        const options = {
            client_id: ENV.X_CLIENT_ID,
            redirect_uri: ENV.X_CALLBACK_URL || '',
            response_type: 'code',
            scope: 'tweet.read users.read offline.access',
            state: req.query.redirect as string || '/dashboard',
            code_challenge: 'challenge',
            code_challenge_method: 'plain',
        };

        const qs = new URLSearchParams(options).toString();
        const authUrl = `${rootUrl}?${qs}`;

        return res.status(200).json({
            success: true,
            data: { url: authUrl },
        });
    } catch (error) {
        logger.error('Failed to generate X auth URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate X authentication',
        });
    }
};

interface XUser {
    data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
    };
}

/**
 * Handle X OAuth callback
 * GET /api/v1/auth/x/callback
 */
export const handleXCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=x_auth_failed`);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${ENV.X_CLIENT_ID}:${ENV.X_CLIENT_SECRET}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: ENV.X_CALLBACK_URL || '',
                code_verifier: 'challenge',
            }),
        });

        const tokenData = await tokenResponse.json() as {
            access_token?: string;
            error?: string;
        };

        if (!tokenResponse.ok || !tokenData.access_token) {
            logger.error('Failed to retrieve X access token', { error: tokenData.error });
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=x_token_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user profile
        const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userData = await userResponse.json() as XUser;

        if (!userResponse.ok || !userData.data) {
            throw new Error('Failed to fetch X user');
        }

        const xUser = userData.data;
        // X API v2 doesn't provide email by default - use username@twitter.placeholder
        const email = `${xUser.username}@x.placeholder.local`;

        // Find or create user
        const transaction = await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({
                where: { email: email.toLowerCase() },
            });

            if (!user) {
                if (!ENV.NEW_SIGNUP_ENABLED) {
                    throw new Error('SIGNUP_DISABLED');
                }

                const { createId } = await import('@paralleldrive/cuid2');
                const userId = createId();

                const nameParts = xUser.name?.split(' ') || [];

                user = await tx.user.create({
                    data: {
                        userId,
                        email: email.toLowerCase(),
                        profileImageUrl: xUser.profile_image_url,
                        firstName: nameParts[0] || xUser.username,
                        lastName: nameParts.slice(1).join(' ') || null,
                        emailVerified: false, // X doesn't provide verified email
                    },
                });
            } else if (!user.profileImageUrl && xUser.profile_image_url) {
                await tx.user.update({
                    where: { userId: user.userId },
                    data: { profileImageUrl: xUser.profile_image_url },
                });
            }

            return user;
        }, { maxWait: 5000, timeout: 10000 });

        // Handle MFA
        if (transaction.mfaEnabled) {
            const jwt = await import('jsonwebtoken');
            const tempToken = jwt.default.sign(
                {
                    userId: transaction.userId,
                    type: 'mfa_pending',
                    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
                    deviceFingerprint: req.headers['user-agent'] || 'unknown',
                },
                ENV.JWT_SECRET,
                { expiresIn: '5m', issuer: 'fairarena' }
            );

            res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
            const redirectTarget = (state as string) || '/dashboard';
            res.cookie('mfa_redirect', redirectTarget, {
                httpOnly: false,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                maxAge: 5 * 60 * 1000,
                path: '/',
            });

            return res.redirect(`${ENV.FRONTEND_URL}/signin`);
        }

        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const userAgentRaw = req.headers['user-agent'];
        const userAgent = parseUserAgent(userAgentRaw);
        const sessionId = await createSession(transaction.userId, refreshToken, {
            deviceName: userAgent.deviceName,
            deviceType: userAgent.deviceType,
            userAgent: userAgentRaw,
            ipAddress: req.ip || 'unknown'
        });
        const newAccessToken = generateAccessToken(transaction.userId, sessionId);

        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
        res.clearCookie('mfa_session', { path: '/' });
        res.clearCookie('mfa_redirect', { path: '/' });

        const redirectPath = (state as string) || '/dashboard';
        return res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'SIGNUP_DISABLED') {
            return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
        }
        logger.error('X auth error', { error: errorMessage });
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
    }
};
