import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import {
    createSession,
    generateAccessToken,
    generateBindingToken,
    generateRefreshToken,
    parseUserAgent,
    storeSessionBinding
} from '../../services/auth.service.js';
import {
    generateOAuthUrl,
    handleGenericOAuthCallback,
} from '../../services/oauth.service.js';
import {
    MFA_SESSION_COOKIE_OPTIONS,
    REFRESH_TOKEN_COOKIE_OPTIONS,
    SESSION_COOKIE_OPTIONS,
} from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';

// Google OAuth client (needed for handleGoogleToken)
const googleClient = new OAuth2Client(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_CALLBACK_URL,
);

// Validation schema for Google token
const googleAuthSchema = z.object({
    credential: z.string().min(1, 'Google credential is required'),
});

// =====================================================
// GENERIC OAuth URL GENERATORS
// =====================================================

export const getGoogleAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('google', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Google auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Google authentication' });
    }
};

export const getGithubAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('github', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate GitHub auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate GitHub authentication' });
    }
};

export const getMicrosoftAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('microsoft', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Microsoft auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Microsoft authentication' });
    }
};

export const getDiscordAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('discord', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Discord auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Discord authentication' });
    }
};

export const getHuggingFaceAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('huggingface', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Hugging Face auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Hugging Face authentication' });
    }
};

export const getGitLabAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('gitlab', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate GitLab auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate GitLab authentication' });
    }
};

export const getSlackAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('slack', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Slack auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Slack authentication' });
    }
};

export const getNotionAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('notion', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Notion auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Notion authentication' });
    }
};

export const getXAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('x', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate X auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate X authentication' });
    }
};

export const getZohoAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('zoho', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Zoho auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Zoho authentication' });
    }
};

export const getLinearAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('linear', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Linear auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Linear authentication' });
    }
};

export const getDropboxAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('dropbox', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Dropbox auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Dropbox authentication' });
    }
};

export const getLinkedInAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('linkedin', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate LinkedIn auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate LinkedIn authentication' });
    }
};

export const getVercelAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('vercel', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Vercel auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Vercel authentication' });
    }
};

export const getFigmaAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('figma', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Figma auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Figma authentication' });
    }
};

export const getZoomAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('zoom', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Zoom auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Zoom authentication' });
    }
};

export const getAtlassianAuthUrl = async (req: Request, res: Response) => {
    try {
        const authUrl = generateOAuthUrl('atlassian', req.query.redirect as string);
        return res.status(200).json({ success: true, data: { url: authUrl } });
    } catch (error) {
        logger.error('Failed to generate Atlassian auth URL', { error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ success: false, message: 'Failed to initiate Atlassian authentication' });
    }
};

// =====================================================
// GENERIC OAuth CALLBACK HANDLERS
// =====================================================

export const handleGoogleCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('google', req, res);
};

export const handleGithubCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('github', req, res);
};

export const handleMicrosoftCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('microsoft', req, res);
};

export const handleDiscordCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('discord', req, res);
};

export const handleHuggingFaceCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('huggingface', req, res);
};

export const handleGitLabCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('gitlab', req, res);
};

export const handleSlackCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('slack', req, res);
};

export const handleNotionCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('notion', req, res);
};

export const handleXCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('x', req, res);
};

export const handleZohoCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('zoho', req, res);
};

export const handleLinearCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('linear', req, res);
};

export const handleDropboxCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('dropbox', req, res);
};

export const handleLinkedInCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('linkedin', req, res);
};

export const handleVercelCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('vercel', req, res);
};

export const handleFigmaCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('figma', req, res);
};

export const handleZoomCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('zoom', req, res);
};

export const handleAtlassianCallback = async (req: Request, res: Response) => {
    return handleGenericOAuthCallback('atlassian', req, res);
};

// =====================================================
// GOOGLE ONE TAP (Unique - not using generic handler)
// =====================================================

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
            const userAgent = req.headers['user-agent'] || 'unknown';
            const { deviceType } = parseUserAgent(userAgent);
            const deviceFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;

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
            });
        }

        // Get device info
        const userAgent = req.headers['user-agent'] as string;
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
        // Generate binding token for session security
        const { token: bindingToken, hash: bindingHash } = generateBindingToken();
        await storeSessionBinding(sessionId, bindingHash);

        // Set multi-session cookies
        res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

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
