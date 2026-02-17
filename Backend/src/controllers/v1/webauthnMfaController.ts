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
import { REFRESH_TOKEN_COOKIE_OPTIONS, SESSION_COOKIE_OPTIONS } from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';

// --- Configuration ---
const rpName = 'FairArena';
const rpID = new URL(ENV.FRONTEND_URL).hostname;
const expectedOrigin = ENV.FRONTEND_URL;

const WEBAUTHN_MFA_CHALLENGE_PREFIX = 'webauthn_mfa:challenge:';
const WEBAUTHN_MFA_CHALLENGE_TTL = 300; // 5 minutes

// --- Schemas ---
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

const authenticateVerifySchema = z.object({
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

const renameDeviceSchema = z.object({
  name: z.string().min(1).max(100),
});

// --- Controller Functions ---

/**
 * Generate registration options for a new security key
 * POST /api/v1/mfa/webauthn/register/options
 */
export async function getRegistrationOptions(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      include: { securityKeys: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: user.email,
      userDisplayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      // Prevent re-registration of existing keys
      excludeCredentials: user.securityKeys.map((key) => ({
        id: key.credentialId,
        transports: key.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        // We don't restrict attachment here to allow USB keys, etc.
      },
      attestationType: 'none',
    });

    // Store challenge
    await redis.setex(
      `${WEBAUTHN_MFA_CHALLENGE_PREFIX}${userId}:register`,
      WEBAUTHN_MFA_CHALLENGE_TTL,
      options.challenge,
    );

    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    logger.error('Error getting registration options', { error });
    return res.status(500).json({ success: false, message: 'Failed to generate options' });
  }
}

/**
 * Verify and store a new security key
 * POST /api/v1/mfa/webauthn/register/verify
 */
export async function verifyRegistration(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const validation = registerVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const { response, name } = validation.data;

    // Retrieve challenge
    const expectedChallenge = await redis.get(`${WEBAUTHN_MFA_CHALLENGE_PREFIX}${userId}:register`);

    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        message: 'Registration session expired. Please try again.',
      });
    }

    // Verify response
    const verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: expectedChallenge as string,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        message: 'Verification failed',
      });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    // Store security key
    const securityKey = await prisma.securityKey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        name: name || 'Security Key',
        transports: (response.response.transports || []) as string[],
      },
    });

    // Cleanup
    await redis.del(`${WEBAUTHN_MFA_CHALLENGE_PREFIX}${userId}:register`);
    await redis.del(`user:securityKeys:${userId}`); // Invalidate cache
    await redis.del(`mfa:prefs:${userId}`);
    await redis.del(`mfa:session_check:${userId}`);
    await redis.del(`mfa:prefs:${userId}`); // Invalidate MFA preferences cache

    logger.info('Security key registered', { userId, keyId: securityKey.id });

    // Notifications
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { email: true, firstName: true },
    });

    if (user) {
      // Send Inngest event for email
      await inngest.send([
        {
          name: 'security/key-added',
          data: {
            userId,
            keyName: securityKey.name,
            addedAt: new Date().toLocaleString(),
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || '',
          },
        },
        {
          name: 'log/create',
          data: {
            userId,
            action: 'SECURITY_KEY_ADDED',
            description: `Added security key "${securityKey.name}"`,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || '',
            metadata: {
              keyId: securityKey.id,
              deviceType: credentialDeviceType,
            },
          },
        },
        {
          name: 'notification/send',
          data: {
            userId,
            title: '🔐 Security Key Added',
            message: `A new security key "${securityKey.name}" was added`,
            description: 'A new security key was registered for multi-factor authentication.',
            actionUrl: '/dashboard/account-settings',
            actionLabel: 'Review Settings',
            metadata: { type: 'security', priority: 'high' },
          },
        },
      ]);
    }

    return res.status(201).json({
      success: true,
      message: 'Security key registered successfully',
      data: {
        id: securityKey.id,
        name: securityKey.name,
        createdAt: securityKey.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error verifying registration', { error });
    return res.status(500).json({ success: false, message: 'Failed to verify registration' });
  }
}

/**
 * Generate authentication options for MFA
 * POST /api/v1/mfa/webauthn/authenticate/options
 */
export async function getAuthenticationOptions(req: Request, res: Response) {
  try {
    // NOTE: This endpoint is usually called when 'mfa_session' cookie is present
    // But we might not have req.user populated if middleware is just checking basic auth
    // We need to extract userId from the mfa_session token if not already in req.user

    let userId = req.user?.userId;

    // If not authenticated via standard means, check MFA temp token
    if (!userId) {
      const mfaToken = req.cookies?.mfa_session || req.body.tempToken;
      if (mfaToken) {
        const jwt = await import('jsonwebtoken');
        try {
          const payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET) as any;
          if (payload.type === 'mfa_pending' || payload.type === 'new_device_pending') {
            userId = payload.userId;
          }
        } catch (e) {
          // Invalid token
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication session required' });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      include: { securityKeys: true },
    });

    if (!user || user.securityKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No security keys registered for this account',
      });
    }

    // Generate options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.securityKeys.map((key) => ({
        id: key.credentialId,
        transports: key.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });

    // Store challenge
    await redis.setex(
      `${WEBAUTHN_MFA_CHALLENGE_PREFIX}${userId}:authenticate`,
      WEBAUTHN_MFA_CHALLENGE_TTL,
      options.challenge,
    );

    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    logger.error('Error generating auth options', { error });
    return res.status(500).json({ success: false, message: 'Failed to generate options' });
  }
}

/**
 * Verify WebAuthn assertion during MFA
 * POST /api/v1/mfa/webauthn/authenticate/verify
 */
export async function verifyAuthentication(req: Request, res: Response) {
  try {
    const validation = authenticateVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Invalid request body' });
    }

    const { response } = validation.data;

    // Extract user ID from MFA session cookie/token similar to auth options
    let userId = req.user?.userId;
    // If not authenticated via standard means, check MFA temp token
    let mfaToken = req.cookies?.mfa_session || req.body.tempToken;

    if (!userId && mfaToken) {
      const jwt = await import('jsonwebtoken');
      try {
        const payload = jwt.default.verify(mfaToken, ENV.JWT_SECRET) as any;
        if (payload.type === 'mfa_pending' || payload.type === 'new_device_pending') {
          userId = payload.userId;
        }
      } catch (e) {
        return res.status(401).json({ success: false, message: 'Session expired' });
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication session required' });
    }

    // Get stored challenge
    const challengeKey = `${WEBAUTHN_MFA_CHALLENGE_PREFIX}${userId}:authenticate`;
    const expectedChallenge = await redis.get(challengeKey);

    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: 'Authentication session expired' });
    }

    // Find security key
    const securityKey = await prisma.securityKey.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });

    if (!securityKey || securityKey.userId !== userId) {
      return res.status(400).json({ success: false, message: 'Security key not found or invalid' });
    }

    // Verify assertion
    const verification = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: expectedChallenge as string,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: securityKey.credentialId,
        publicKey: Buffer.from(securityKey.publicKey, 'base64url'),
        counter: Number(securityKey.counter),
        transports: securityKey.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, message: 'Verification failed' });
    }

    // Update counter
    await prisma.securityKey.update({
      where: { id: securityKey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Clean up challenge
    await redis.del(challengeKey);

    // --- SUCCESSFUL AUTHENTICATION LOGIC ---
    // Duplicate logic from verifyLoginMFA in authController.ts
    // But for clarity/DRY we should perform the final login steps here or return a success
    // that allows the frontend to proceed?
    // Actually, this IS the verification step, so we should issue the tokens here.

    const user = securityKey.user;
    const refreshToken = generateRefreshToken();

    // Get device info
    const userAgent = req.headers['user-agent'] as string;
    const deviceInfo = parseUserAgent(userAgent);
    const ipAddress = req.ip || 'unknown';

    const sessionId = await createSession(
      user.userId,
      refreshToken,
      { ...deviceInfo, userAgent, ipAddress },
      { isBanned: user.isBanned, banReason: user.banReason },
    );
    const accessToken = generateAccessToken(user.userId, sessionId);

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
    });

    // Set cookies
    // Re-import cookie options from authController or define locally (best to import to stay synced)
    // For now defining same as authController
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('sessionId', sessionId, SESSION_COOKIE_OPTIONS);
    res.clearCookie('mfa_session', { path: '/' });

    // Register this device as known for 7 days to prevent future new device prompts
    const deviceFingerprint = `${deviceInfo.deviceType}:${userAgent?.substring(0, 50) || 'unknown'}`;
    const recentDeviceKey = `recent_device:${user.userId}:${deviceFingerprint}`;
    await redis.setex(recentDeviceKey, 7 * 24 * 60 * 60, '1'); // 7 days

    logger.info('User logged in via WebAuthn MFA', {
      userId: user.userId,
      deviceFingerprint,
    });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
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
    logger.error('Error verifying WebAuthn MFA', { error });
    return res.status(500).json({ success: false, message: 'Failed to verify authentication' });
  }
}

/**
 * List registered security keys
 * GET /api/v1/mfa/webauthn/devices
 */
export async function listSecurityKeys(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const cacheKey = `user:securityKeys:${userId}`;
    const cachedKeys = await redis.get(cacheKey);

    if (cachedKeys) {
      try {
        const data = typeof cachedKeys === 'string' ? JSON.parse(cachedKeys) : cachedKeys;
        return res.status(200).json({
          success: true,
          data,
        });
      } catch (error) {
        logger.warn('Error parsing cached security keys, falling back to DB', {
          error: error instanceof Error ? error.message : String(error),
        });
        await redis.del(cacheKey);
      }
    }

    const keys = await prisma.securityKey.findMany({
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

    await redis.setex(
      cacheKey,
      3600,
      JSON.stringify(keys, (key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    );

    return res.status(200).json({
      success: true,
      data: keys,
    });
  } catch (error) {
    logger.error('Error listing security keys', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ success: false, message: 'Failed to list keys' });
  }
}

/**
 * Delete a security key
 * DELETE /api/v1/mfa/webauthn/devices/:id
 */
export async function deleteSecurityKey(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const key = await prisma.securityKey.findFirst({ where: { id, userId } });
    if (!key) return res.status(404).json({ message: 'Device not found' });

    // Check if user has Super Secure Account or disableOTPReverification enabled
    // If so, they cannot delete their last security key
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        email: true,
        superSecureAccountEnabled: true,
        disableOTPReverification: true,
        _count: { select: { securityKeys: true } },
      },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Security check: Cannot delete last security key if advanced security is enabled
    if (user._count.securityKeys <= 1) {
      if (user.superSecureAccountEnabled) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot remove your only security key while Super Secure Account is enabled. Please disable Super Secure Account first.',
          code: 'LAST_KEY_PROTECTED',
        });
      }
      if (user.disableOTPReverification) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot remove your only security key while OTP re-verification is disabled. Please re-enable OTP re-verification first.',
          code: 'LAST_KEY_PROTECTED',
        });
      }
    }

    await prisma.securityKey.delete({ where: { id } });
    await redis.del(`user:securityKeys:${userId}`);
    await redis.del(`mfa:prefs:${userId}`);
    await redis.del(`mfa:session_check:${userId}`);
    await redis.del(`mfa:prefs:${userId}`); // Invalidate MFA preferences cache

    // Notifications
    if (user) {
      await inngest.send([
        {
          name: 'security/key-removed',
          data: {
            userId,
            keyName: key.name,
            removedAt: new Date().toLocaleString(),
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || '',
          },
        },
        {
          name: 'log/create',
          data: {
            userId,
            action: 'SECURITY_KEY_REMOVED',
            description: `Removed security key "${key.name}"`,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || '',
            metadata: { keyId: id },
          },
        },
        {
          name: 'notification/send',
          data: {
            userId,
            title: '🗑️ Security Key Removed',
            message: `Security key "${key.name}" was removed`,
            description: 'A security key was removed from your account.',
            actionUrl: '/dashboard/account-settings',
            actionLabel: 'Review Settings',
            metadata: { type: 'security', priority: 'high' },
          },
        },
      ]);
    }

    logger.info('Security key deleted', { userId, keyId: id });

    return res.status(200).json({ success: true, message: 'Device removed' });
  } catch (error) {
    logger.error('Error deleting security key', { error });
    return res.status(500).json({ success: false, message: 'Failed to delete device' });
  }
}

/**
 * Rename a security key
 * PATCH /api/v1/mfa/webauthn/devices/:id/rename
 */
export async function renameSecurityKey(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;

    const validation = renameDeviceSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ message: 'Invalid name' });

    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const key = await prisma.securityKey.findFirst({ where: { id, userId } });
    if (!key) return res.status(404).json({ message: 'Device not found' });

    await prisma.securityKey.update({
      where: { id },
      data: { name: validation.data.name },
    });
    await redis.del(`user:securityKeys:${userId}`);

    return res.status(200).json({ success: true, message: 'Device renamed' });
  } catch (error) {
    logger.error('Error renaming security key', { error });
    return res.status(500).json({ success: false, message: 'Failed to rename device' });
  }
}
