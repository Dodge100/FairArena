import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
    AuthenticationResponseJSON,
    AuthenticatorTransportFuture,
    RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import {
    createSession,
    generateAccessToken,
    generateRefreshToken,
    parseUserAgent,
} from '../../services/auth.service.js';
import {
    REFRESH_TOKEN_COOKIE_OPTIONS,
    SESSION_COOKIE_OPTIONS,
} from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';

// --- Configuration ---
// The Relying Party (RP) configuration
const rpName = 'FairArena';
// In production, this should be the actual domain (e.g., 'fairarena.com')
const rpID = new URL(ENV.FRONTEND_URL).hostname;
// The expected origin(s) for the WebAuthn requests
const expectedOrigin = ENV.FRONTEND_URL;

// Redis keys for challenge storage
const PASSKEY_CHALLENGE_PREFIX = 'passkey:challenge:';
const PASSKEY_CHALLENGE_TTL = 300; // 5 minutes

// --- Validation Schemas ---
const registerVerifySchema = z.object({
    response: z.object({
        id: z.string(),
        rawId: z.string(),
        response: z.object({
            clientDataJSON: z.string(),
            attestationObject: z.string(),
            transports: z.array(z.string()).optional(),
        }),
        type: z.enum(['public-key']),
        clientExtensionResults: z.record(z.string(), z.any()).optional(),
        authenticatorAttachment: z.string().optional(),
    }),
    name: z.string().max(100).optional(),
});

const loginOptionsSchema = z.object({
    email: z.string().email().optional(),
});

const loginVerifySchema = z.object({
    response: z.object({
        id: z.string(),
        rawId: z.string(),
        response: z.object({
            clientDataJSON: z.string(),
            authenticatorData: z.string(),
            signature: z.string(),
            userHandle: z.string().optional(),
        }),
        type: z.enum(['public-key']),
        clientExtensionResults: z.record(z.string(), z.any()).optional(),
        authenticatorAttachment: z.string().optional(),
    }),
});

const renamePasskeySchema = z.object({
    name: z.string().min(1).max(100),
});


export async function getRegistrationOptions(req: Request, res: Response) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Get user and existing passkeys
        const user = await prisma.user.findUnique({
            where: { userId },
            include: {
                passkeys: true,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Generate registration options
        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: new TextEncoder().encode(userId),
            userName: user.email,
            userDisplayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            // Prevent re-registration of existing passkeys
            excludeCredentials: user.passkeys.map((passkey) => ({
                id: passkey.credentialId,
                transports: passkey.transports as AuthenticatorTransportFuture[],
            })),
            authenticatorSelection: {
                // Prefer platform authenticators (Touch ID, Windows Hello, etc.)
                authenticatorAttachment: 'platform',
                requireResidentKey: true,
                userVerification: 'preferred',
            },
            attestationType: 'none', // We don't need attestation for this use case
        });

        // Store the challenge in Redis for verification
        await redis.setex(
            `${PASSKEY_CHALLENGE_PREFIX}${userId}:register`,
            PASSKEY_CHALLENGE_TTL,
            options.challenge
        );

        logger.info('Generated passkey registration options', { userId });

        return res.status(200).json({
            success: true,
            data: options,
        });
    } catch (error) {
        logger.error('Error generating registration options', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to generate registration options',
        });
    }
}

/**
 * Verify and store a new passkey registration
 * POST /api/v1/passkeys/register/verify
 */
export async function verifyRegistration(req: Request, res: Response) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Validate request body
        const validation = registerVerifySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body',
                errors: validation.error.issues,
            });
        }

        const { response, name } = validation.data;

        // Retrieve the expected challenge from Redis
        const expectedChallenge = await redis.get(
            `${PASSKEY_CHALLENGE_PREFIX}${userId}:register`
        );

        if (!expectedChallenge) {
            return res.status(400).json({
                success: false,
                message: 'Registration session expired. Please try again.',
            });
        }

        // Verify the registration response
        const verification = await verifyRegistrationResponse({
            response: response as RegistrationResponseJSON,
            expectedChallenge: expectedChallenge as string,
            expectedOrigin,
            expectedRPID: rpID,
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({
                success: false,
                message: 'Registration verification failed',
            });
        }

        const { credential, credentialDeviceType } = verification.registrationInfo;

        // Store the new passkey
        const passkey = await prisma.passkey.create({
            data: {
                userId,
                credentialId: credential.id,
                publicKey: Buffer.from(credential.publicKey).toString('base64url'),
                counter: BigInt(credential.counter),
                deviceType: credentialDeviceType,
                name: name || getDefaultPasskeyName(req),
                transports: (response.response.transports || []) as string[],
            },
        });

        // Clean up the challenge
        await redis.del(`${PASSKEY_CHALLENGE_PREFIX}${userId}:register`);
        // Invalidate passkey list cache
        await redis.del(`user:passkeys:${userId}`);

        logger.info('Passkey registered successfully', { userId, passkeyId: passkey.id });

        // Get user details for notifications
        const user = await prisma.user.findUnique({
            where: { userId },
            select: { email: true, firstName: true }
        });

        if (user) {
            // Send in-app notification
            await inngest.send({
                name: 'notification/send',
                data: {
                    userId,
                    title: '🔐 New Passkey Added',
                    message: `A new passkey "${passkey.name}" was added to your account`,
                    description: `A new passkey was registered for your account. If this wasn't you, please remove it immediately and secure your account.`,
                    actionUrl: '/dashboard/profile',
                    actionLabel: 'Review Passkeys',
                    metadata: {
                        type: 'security',
                        priority: 'high',
                        action: 'passkey_added',
                        passkeyName: passkey.name,
                    },
                },
            });

            // Send email notification
            await inngest.send({
                name: 'email/passkey-added',
                data: {
                    userId,
                    email: user.email,
                    firstName: user.firstName,
                    passkeyName: passkey.name || 'Security Key',
                },
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Passkey registered successfully',
            data: {
                id: passkey.id,
                name: passkey.name,
                deviceType: passkey.deviceType,
                createdAt: passkey.createdAt,
            },
        });
    } catch (error) {
        logger.error('Error verifying registration', {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to verify registration',
        });
    }
}

/**
 * Generate authentication options for passkey login
 * POST /api/v1/passkeys/login/options
 */
export async function getAuthenticationOptions(req: Request, res: Response) {
    try {
        const validation = loginOptionsSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body',
                errors: validation.error.issues,
            });
        }

        const { email } = validation.data;

        // If email is provided, get the user's passkeys for allowCredentials
        let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];

        if (email) {
            const user = await prisma.user.findUnique({
                where: { email },
                include: { passkeys: true },
            });

            if (user && user.passkeys.length > 0) {
                allowCredentials = user.passkeys.map((passkey) => ({
                    id: passkey.credentialId,
                    transports: passkey.transports as AuthenticatorTransportFuture[],
                }));
            }
        }

        // Generate authentication options
        const options = await generateAuthenticationOptions({
            rpID,
            userVerification: 'preferred',
            // If no email provided, allow any passkey (discoverable credentials)
            allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        });

        // Store challenge in Redis (use a session-based key for unauthenticated users)
        const challengeKey = email
            ? `${PASSKEY_CHALLENGE_PREFIX}${email}:login`
            : `${PASSKEY_CHALLENGE_PREFIX}session:${options.challenge}`;

        await redis.setex(challengeKey, PASSKEY_CHALLENGE_TTL, JSON.stringify({
            challenge: options.challenge,
            email,
        }));

        logger.info('Generated passkey authentication options', { email: email || 'discoverable' });

        return res.status(200).json({
            success: true,
            data: options,
        });
    } catch (error) {
        logger.error('Error generating authentication options', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to generate authentication options',
        });
    }
}

/**
 * Verify passkey authentication and log in user
 * POST /api/v1/passkeys/login/verify
 */
export async function verifyAuthentication(req: Request, res: Response) {
    try {
        const validation = loginVerifySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body',
                errors: validation.error.issues,
            });
        }

        const { response } = validation.data;

        // Find the passkey by credential ID
        const passkey = await prisma.passkey.findUnique({
            where: { credentialId: response.id },
            include: { user: true },
        });

        if (!passkey) {
            return res.status(401).json({
                success: false,
                message: 'Passkey not found',
            });
        }

        // Check if user is banned
        if (passkey.user.isBanned) {
            return res.status(403).json({
                success: false,
                message: `Your account has been suspended. Reason: ${passkey.user.banReason || 'Violation of terms'}`,
                code: 'USER_BANNED',
            });
        }

        // Check if user is deleted
        if (passkey.user.isDeleted) {
            return res.status(401).json({
                success: false,
                message: 'Account not found',
            });
        }

        // Try to find the challenge
        let expectedChallenge: string | null = null;

        // First try email-based key
        const emailChallengeData = await redis.get(
            `${PASSKEY_CHALLENGE_PREFIX}${passkey.user.email}:login`
        );

        if (emailChallengeData) {
            const parsed = typeof emailChallengeData === 'string' ? JSON.parse(emailChallengeData) : emailChallengeData as { challenge: string };
            expectedChallenge = parsed.challenge;
        } else {
            // For discoverable credentials (or if email flow expired/mismatched),
            // extract the challenge from the client response and check if it exists in our session store.

            // 1. Decode clientDataJSON to peek at the challenge
            const clientDataJSON = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8');
            const clientData = JSON.parse(clientDataJSON);
            const claimedChallenge = clientData.challenge;

            // 2. Check if this specific challenge exists in Redis
            const sessionKey = `${PASSKEY_CHALLENGE_PREFIX}session:${claimedChallenge}`;
            const sessionData = await redis.get(sessionKey);

            if (sessionData) {
                const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData as { challenge: string };
                expectedChallenge = parsed.challenge;

                // Clean up this specific session challenge after use
                await redis.del(sessionKey);
            }
        }

        if (!expectedChallenge) {
            return res.status(400).json({
                success: false,
                message: 'Authentication session expired. Please try again.',
            });
        }

        // Verify the authentication response
        const verification = await verifyAuthenticationResponse({
            response: response as AuthenticationResponseJSON,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            credential: {
                id: passkey.credentialId,
                publicKey: Buffer.from(passkey.publicKey, 'base64url'),
                counter: Number(passkey.counter),
                transports: passkey.transports as AuthenticatorTransportFuture[],
            },
        });

        if (!verification.verified) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed',
            });
        }

        // Update the passkey counter and last used time
        await prisma.passkey.update({
            where: { id: passkey.id },
            data: {
                counter: BigInt(verification.authenticationInfo.newCounter),
                lastUsedAt: new Date(),
            },
        });

        // Clean up challenges
        await redis.del(`${PASSKEY_CHALLENGE_PREFIX}${passkey.user.email}:login`);

        // Generate tokens and set cookies (similar to normal login)
        const { user } = passkey;

        // Generate refresh token and create session
        const refreshToken = generateRefreshToken();

        // Get device info
        const userAgent = req.headers['user-agent'] as string | undefined;
        const deviceInfo = parseUserAgent(userAgent);
        const { deviceName, deviceType } = deviceInfo;
        const ipAddress = req.ip || 'unknown';

        const sessionId = await createSession(
            user.userId,
            refreshToken,
            {
                ...deviceInfo,
                userAgent,
                ipAddress,
            },
            { isBanned: user.isBanned, banReason: user.banReason }
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

        // Check for new device
        const deviceFingerprint = `${deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
        const recentDeviceKey = `recent_device:${user.userId}:${deviceFingerprint}`;
        const isKnownDevice = await redis.get(recentDeviceKey);

        await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1');

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
                    method: 'passkey'
                },
            },
        });

        if (!isKnownDevice) {
            // Send new device email
            await inngest.send({
                name: 'email/new-device-login',
                data: {
                    userId: user.userId,
                    sessionId,
                    ipAddress,
                    userAgent: userAgent || 'unknown',
                },
            });

            // Send new device notification
            await inngest.send({
                name: 'notification/send',
                data: {
                    userId: user.userId,
                    title: 'New Device Login',
                    message: `Login detected from ${deviceName}`,
                    description: `A new login was detected from ${deviceType} using Passkey. If this wasn't you, secure your account.`,
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

            logger.info('New device login detected via passkey', { userId: user.userId, deviceType, sessionId });

            await inngest.send({
                name: 'email/new-device-login',
                data: {
                    userId: user.userId,
                    sessionId,
                    ipAddress,
                    userAgent,
                },
            });
        }

        // Set cookies
        res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
        res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);

        logger.info('Passkey authentication successful', { userId: user.userId, passkeyId: passkey.id });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
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
        logger.error('Error verifying authentication', {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to verify authentication',
        });
    }
}

/**
 * List user's registered passkeys
 * GET /api/v1/passkeys
 */
export async function listPasskeys(req: Request, res: Response) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const cacheKey = `user:passkeys:${userId}`;
        const cachedPasskeys = await redis.get(cacheKey);

        if (cachedPasskeys) {
            return res.status(200).json({
                success: true,
                data: typeof cachedPasskeys === 'string' ? JSON.parse(cachedPasskeys) : cachedPasskeys,
            });
        }

        const passkeys = await prisma.passkey.findMany({
            where: { userId },
            select: {
                id: true,
                name: true,
                deviceType: true,
                createdAt: true,
                lastUsedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(passkeys));

        return res.status(200).json({
            success: true,
            data: passkeys,
        });
    } catch (error) {
        logger.error('Error listing passkeys', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to list passkeys',
        });
    }
}

/**
 * Delete a passkey
 * DELETE /api/v1/passkeys/:id
 */
export async function deletePasskey(req: Request, res: Response) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const { id } = req.params;

        // Find and verify ownership
        const passkey = await prisma.passkey.findFirst({
            where: { id, userId },
        });

        if (!passkey) {
            return res.status(404).json({
                success: false,
                message: 'Passkey not found',
            });
        }

        // Check if user has Super Secure Account enabled and this is their last passkey
        const user = await prisma.user.findUnique({
            where: { userId },
            select: {
                email: true,
                firstName: true,
                superSecureAccountEnabled: true,
                _count: { select: { passkeys: true } }
            }
        });

        if (user?.superSecureAccountEnabled && user._count.passkeys <= 1) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your last passkey while Super Secure Account is enabled. Please disable Super Secure Account first or add another passkey.',
                code: 'LAST_PASSKEY_WITH_SUPER_SECURE',
            });
        }

        await prisma.passkey.delete({
            where: { id },
        });

        // Invalidate passkey list cache
        await redis.del(`user:passkeys:${userId}`);

        logger.info('Passkey deleted', { userId, passkeyId: id });


        if (user) {
            // Send in-app notification
            await inngest.send({
                name: 'notification/send',
                data: {
                    userId,
                    title: '🔐 Passkey Removed',
                    message: `A passkey "${passkey.name || 'Security Key'}" was removed from your account`,
                    description: `A passkey was removed from your account. If this wasn't you, please secure your account immediately by changing your password and reviewing your sessions.`,
                    actionUrl: '/dashboard/profile',
                    actionLabel: 'Secure Account',
                    metadata: {
                        type: 'security',
                        priority: 'high',
                        action: 'passkey_removed',
                        passkeyName: passkey.name,
                    },
                },
            });

            // Send email notification
            await inngest.send({
                name: 'email/passkey-removed',
                data: {
                    userId,
                    email: user.email,
                    firstName: user.firstName,
                    passkeyName: passkey.name || 'Security Key',
                },
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Passkey deleted successfully',
        });
    } catch (error) {
        logger.error('Error deleting passkey', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to delete passkey',
        });
    }
}

/**
 * Rename a passkey
 * PATCH /api/v1/passkeys/:id/rename
 */
export async function renamePasskey(req: Request, res: Response) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const { id } = req.params;

        const validation = renamePasskeySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body',
                errors: validation.error.issues,
            });
        }

        const { name } = validation.data;

        // Find and verify ownership
        const passkey = await prisma.passkey.findFirst({
            where: { id, userId },
        });

        if (!passkey) {
            return res.status(404).json({
                success: false,
                message: 'Passkey not found',
            });
        }

        const updated = await prisma.passkey.update({
            where: { id },
            data: { name },
        });

        // Invalidate passkey list cache
        await redis.del(`user:passkeys:${userId}`);

        logger.info('Passkey renamed', { userId, passkeyId: id, newName: name });

        return res.status(200).json({
            success: true,
            message: 'Passkey renamed successfully',
            data: {
                id: updated.id,
                name: updated.name,
            },
        });
    } catch (error) {
        logger.error('Error renaming passkey', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to rename passkey',
        });
    }
}

// --- Helper Functions ---

function getDefaultPasskeyName(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';

    if (userAgent.includes('Mac')) return 'MacBook';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Linux')) return 'Linux PC';

    return 'Security Key';
}
