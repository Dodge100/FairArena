import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ENV } from '../../config/env.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import { getAccountSettingsCookieOptions } from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';
import { Verifier } from '../../utils/settings-token-verfier.js';

// Constants for OTP verification
const TOKEN_EXPIRY_MINUTES = ENV.NODE_ENV === 'production' ? 10 : 120;
const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const MAX_OTP_SEND_ATTEMPTS = 5; // Maximum 5 OTP requests
const OTP_SEND_WINDOW_SECONDS = 1800; // Within 30 minutes
const OTP_COOLDOWN_SECONDS = 60; // 1 minute between requests
const MAX_OTP_VERIFY_ATTEMPTS = 5; // Maximum 5 verification attempts
const OTP_VERIFY_WINDOW_SECONDS = 1800; // Within 30 minutes (half hour)

// Validation schemas
const verifyOtpSchema = z.object({
  otp: z
    .string()
    .trim()
    .min(6, 'OTP must be at least 6 characters')
    .max(12, 'OTP must be at most 12 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'OTP must be alphanumeric')
    .transform((val) => val.toUpperCase()), // Normalize to uppercase for case-insensitive comparison
});

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info('Sending OTP for account settings', { userId: auth.userId });

    const cooldownKey = `${REDIS_KEYS.OTP_STORE}${auth.userId}:account-settings:cooldown`;
    const attemptsKey = `${REDIS_KEYS.OTP_STORE}${auth.userId}:account-settings:attempts`;

    // Check cooldown period (1 minute between requests)
    let cooldown, ttl;
    try {
      cooldown = await redis.get(cooldownKey);
      if (cooldown) {
        ttl = await redis.ttl(cooldownKey);
        if (ttl > 0) {
          logger.warn('OTP request blocked by cooldown', {
            userId: auth.userId,
            remainingSeconds: ttl,
          });
          return res.status(429).json({
            success: false,
            message: `Please wait ${ttl} seconds before requesting another OTP`,
            retryAfter: ttl,
          });
        }
      }
    } catch (redisError) {
      logger.error('Redis error checking cooldown', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue without rate limiting if Redis is down (fail open for availability)
    }

    // Check rate limiting (5 requests per 30 minutes)
    let currentAttempts = 0;
    try {
      const attempts = await redis.get(attemptsKey);
      currentAttempts = typeof attempts === 'number' ? attempts : 0;

      if (currentAttempts >= MAX_OTP_SEND_ATTEMPTS) {
        const ttl = await redis.ttl(attemptsKey);
        const remainingMinutes = Math.ceil(ttl / 60);
        logger.warn('OTP request blocked by rate limit', {
          userId: auth.userId,
          attempts: currentAttempts,
          remainingMinutes,
        });
        return res.status(429).json({
          success: false,
          message: `Too many OTP requests. Please try again in ${remainingMinutes} minutes`,
          retryAfter: ttl,
        });
      }
    } catch (redisError) {
      logger.error('Redis error checking rate limit', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue without rate limiting if Redis is down
    }

    // Set cooldown (1 minute)
    try {
      await redis.setex(cooldownKey, OTP_COOLDOWN_SECONDS, '1');

      // Increment attempts counter (30-minute window)
      if (currentAttempts === 0) {
        await redis.setex(attemptsKey, OTP_SEND_WINDOW_SECONDS, 1);
      } else {
        await redis.incr(attemptsKey);
      }
    } catch (redisError) {
      logger.error('Redis error setting rate limit', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue - OTP will still be sent even if rate limiting fails
    }

    await inngest.send({
      name: 'account-settings/send-otp',
      data: { userId: auth.userId, ip: req.ip },
    });

    inngest.send({
      name: 'log.create',
      data: {
        userId: auth.userId,
        action: 'sensitive-action-attempted',
        level: 'WARN',
      },
    });

    logger.info('OTP request accepted, rate limit updated', {
      userId: auth.userId,
      attempts: currentAttempts + 1,
    });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    logger.error('Send OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate OTP format
    const validation = verifyOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid OTP format', {
        userId: auth.userId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        success: false,
        message: 'OTP must be 6-12 alphanumeric characters',
      });
    }

    const { otp } = validation.data;

    logger.info('Verifying OTP for account settings', { userId: auth.userId });

    // Check for rate limiting (brute force protection) using Redis
    const verifyAttemptsKey = `${REDIS_KEYS.OTP_ATTEMPTS}${auth.userId}:account-settings:verify`;
    const verifyLockoutKey = `${REDIS_KEYS.OTP_LOCKOUT}${auth.userId}:account-settings:verify`;

    // Check if user is currently locked out from verification
    try {
      const lockoutUntil = await redis.get(verifyLockoutKey);
      if (lockoutUntil) {
        const ttl = await redis.ttl(verifyLockoutKey);
        if (ttl > 0) {
          const remainingMinutes = Math.ceil(ttl / 60);
          logger.warn('User is locked out from OTP verification', {
            userId: auth.userId,
            remainingMinutes,
          });
          return res.status(429).json({
            success: false,
            message: `Too many failed attempts. Please try again in ${remainingMinutes} minutes`,
            retryAfter: ttl,
          });
        }
      }
    } catch (redisError) {
      logger.error('Redis error checking lockout', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue - fail open for availability
    }

    // Check current verification attempts in the window
    let verifyAttempts = 0;
    try {
      const currentVerifyAttempts = await redis.get(verifyAttemptsKey);
      verifyAttempts = typeof currentVerifyAttempts === 'number' ? currentVerifyAttempts : 0;

      if (verifyAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        // Lock out the user
        await redis.setex(verifyLockoutKey, OTP_VERIFY_WINDOW_SECONDS, '1');
        logger.warn('User locked out after too many verification attempts', {
          userId: auth.userId,
          attempts: verifyAttempts,
        });
        return res.status(429).json({
          success: false,
          message: `Too many failed attempts. Please try again in ${Math.ceil(OTP_VERIFY_WINDOW_SECONDS / 60)} minutes`,
          retryAfter: OTP_VERIFY_WINDOW_SECONDS,
        });
      }
    } catch (redisError) {
      logger.error('Redis error checking verification attempts', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue - fail open
    }

    // Get OTP data from Redis
    const otpKey = `${REDIS_KEYS.OTP_STORE}${auth.userId}:account-settings`;
    let otpDataRaw;

    try {
      otpDataRaw = await redis.get(otpKey);
    } catch (redisError) {
      logger.error('Redis error fetching OTP', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to verify OTP. Please try again',
      });
    }

    if (!otpDataRaw) {
      logger.warn('No valid OTP found in Redis', { userId: auth.userId });
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new OTP',
      });
    }

    // Upstash Redis returns object directly when value is JSON
    let otpData;
    try {
      otpData = typeof otpDataRaw === 'string' ? JSON.parse(otpDataRaw) : otpDataRaw;

      // Validate OTP data structure
      if (!otpData.otpHash || !otpData.userId || typeof otpData.attempts !== 'number') {
        throw new Error('Invalid OTP data structure');
      }
    } catch (parseError) {
      logger.error('Failed to parse OTP data', {
        userId: auth.userId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      await redis.del(otpKey); // Clean up corrupted data
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP data. Please request a new OTP',
      });
    }

    // Check if OTP has been verified too many times (max 5 attempts)
    if (otpData.attempts >= 5) {
      logger.warn('OTP verification attempts exceeded', { userId: auth.userId });
      await redis.del(otpKey); // Delete the OTP
      return res.status(400).json({
        success: false,
        message: 'OTP expired due to too many attempts',
      });
    }

    // Verify the OTP using constant-time comparison
    let isValid = false;
    try {
      isValid = await bcrypt.compare(otp.toUpperCase(), otpData.otpHash);
    } catch (bcryptError) {
      logger.error('Bcrypt comparison error', {
        userId: auth.userId,
        error: bcryptError instanceof Error ? bcryptError.message : String(bcryptError),
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to verify OTP. Please try again',
      });
    }

    if (!isValid) {
      // Increment OTP-specific verification attempts (max 5 per OTP)
      otpData.attempts = (otpData.attempts || 0) + 1;

      try {
        if (otpData.attempts >= 5) {
          // Delete OTP after 5 failed attempts
          await redis.del(otpKey);
          logger.warn('OTP deleted after 5 failed attempts', { userId: auth.userId });
        } else {
          // Update OTP data with new attempt count
          await redis.set(otpKey, JSON.stringify(otpData), {
            ex: OTP_EXPIRY_SECONDS,
          });
        }

        // Increment global verification attempts (rate limiting)
        if (verifyAttempts === 0) {
          await redis.setex(verifyAttemptsKey, OTP_VERIFY_WINDOW_SECONDS, 1);
        } else {
          await redis.incr(verifyAttemptsKey);
        }
      } catch (redisError) {
        logger.error('Redis error updating verification attempts', {
          userId: auth.userId,
          error: redisError instanceof Error ? redisError.message : String(redisError),
        });
        // Continue - user will still get error response
      }

      logger.warn('Invalid OTP provided', {
        userId: auth.userId,
        otpAttempts: otpData.attempts,
        windowAttempts: verifyAttempts + 1,
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        remainingAttempts: Math.max(0, 5 - otpData.attempts),
      });
    }

    // Success - clear lockout and delete the OTP (keep verification attempts counter)
    try {
      await Promise.all([
        redis.del(verifyLockoutKey),
        redis.del(otpKey), // Delete OTP after successful verification
      ]);
    } catch (redisError) {
      logger.error('Redis error cleaning up after successful verification', {
        userId: auth.userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue - verification was successful
    }

    // Generate JWT token for account settings access with device binding
    const deviceFingerprint = {
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress || 'unknown',
    };

    const token = jwt.sign(
      {
        userId: auth.userId,
        purpose: 'account-settings',
        device: deviceFingerprint,
      },
      ENV.JWT_SECRET,
      {
        expiresIn: `${TOKEN_EXPIRY_MINUTES}m`,
      },
    );

    // Set secure cookie
    res.cookie('account-settings-token', token, getAccountSettingsCookieOptions(TOKEN_EXPIRY_MINUTES));

    inngest.send({
      name: 'log.create',
      data: {
        userId: auth.userId,
        action: 'sensitive-action-verified',
        level: 'CRITICAL',
      },
    });

    logger.info('OTP verified successfully', { userId: auth.userId });
    res.json({ success: true, message: 'Verification successful' });
  } catch (error) {
    logger.error('Verify OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

export const checkStatus = async (req: Request, res: Response) => {
  try {
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      Verifier(req, res, auth);
      res.json({ success: true, verified: true });
    } catch (error) {
      res.status(401).json({ success: false, message: (error as Error).message });
    }
  } catch (error) {
    logger.error('Status check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Status check failed' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
      Verifier(req, res, auth);
    } catch (error) {
      return res.status(401).json({ success: false, message: (error as Error).message });
    }

    const cacheKey = `${REDIS_KEYS.USER_LOGS_CACHE}${userId}`;

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      logger.info(`Logs cache check for user ${userId}: ${cached ? 'HIT' : 'MISS'}`, {
        cacheKey,
        cachedType: typeof cached,
      });
      if (cached !== null && cached !== undefined) {
        try {
          logger.info('Returning cached logs data', { userId });
          const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.json(parsedData);
        } catch (parseError) {
          logger.warn('Failed to parse cached logs data, falling back to database', {
            error: parseError,
            userId,
          });
          // Continue to database query
        }
      }
    } catch (error) {
      logger.warn('Redis cache read failed for user logs', { error, userId });
    }

    inngest.send({
      name: 'log.create',
      data: {
        userId,
        action: 'logs-accessed',
        level: 'CRITICAL',
      },
    });

    const logs = await getReadOnlyPrisma().logs.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        action: true,
        level: true,
        metadata: true,
        createdAt: true,
      },
    });

    const responseData = { success: true, logs };

    // Cache the result for 1 hour
    try {
      await redis.setex(cacheKey, 3600, JSON.stringify(responseData));
      logger.info('Logs cache set successfully', { userId, cacheKey });
    } catch (error) {
      logger.warn('Redis cache write failed for user logs', { error, userId });
    }

    res.json(responseData);
  } catch (error) {
    logger.error('Get logs error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

export const exportUserData = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info('User data export requested', { userId });

    // Check rate limiting for data export (once per 24 hours)
    const exportKey = `${REDIS_KEYS.DATA_EXPORT}${userId}:last-export`;
    try {
      const lastExport = await redis.get(exportKey);
      if (lastExport) {
        const lastExportTime = new Date(typeof lastExport === 'string' ? lastExport : '');
        const now = new Date();
        const hoursSinceLastExport = (now.getTime() - lastExportTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastExport < 24) {
          const remainingHours = Math.ceil(24 - hoursSinceLastExport);
          logger.warn('Data export request blocked by rate limit', {
            userId,
            lastExport: lastExportTime,
            remainingHours,
          });
          return res.status(429).json({
            success: false,
            message: `You can request a data export once every 24 hours. Please try again in ${remainingHours} hours.`,
          });
        }
      }
    } catch (redisError) {
      logger.error('Redis error checking data export rate limit', {
        userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue without rate limiting if Redis is down
    }

    // Trigger the Inngest function for data export
    await inngest.send({
      name: 'user/export-data',
      data: { userId },
    });

    // Set the last export time
    try {
      await redis.setex(exportKey, 24 * 60 * 60, new Date().toISOString()); // 24 hours
    } catch (redisError) {
      logger.error('Redis error setting data export timestamp', {
        userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
      // Continue - export will still proceed
    }

    // Log the export request
    inngest.send({
      name: 'log.create',
      data: {
        userId,
        action: 'data-export-requested',
        level: 'INFO',
      },
    });

    res.json({
      success: true,
      message: 'Data export has been initiated. You will receive an email with your data shortly.',
    });
  } catch (error) {
    logger.error('Export user data error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Failed to initiate data export' });
  }
};

// =============================================================================
// WEBAUTHN RE-VERIFICATION FOR ACCOUNT SETTINGS
// Alternative to OTP for users who have security keys configured
// =============================================================================

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { prisma } from '../../config/database.js';

const WEBAUTHN_RP_ID = ENV.NODE_ENV === 'production' ? new URL(ENV.FRONTEND_URL).hostname : 'localhost';
const WEBAUTHN_ORIGIN = ENV.FRONTEND_URL
const WEBAUTHN_CHALLENGE_PREFIX = 'account_settings_webauthn:challenge:';
const WEBAUTHN_CHALLENGE_TTL = 300; // 5 minutes

/**
 * Get WebAuthn authentication options for account settings re-verification
 * POST /api/v1/account-settings/webauthn/options
 */
export const getWebAuthnOptions = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get user's security keys
    const securityKeys = await prisma.securityKey.findMany({
      where: { userId: auth.userId },
      select: {
        credentialId: true,
        transports: true,
      },
    });

    if (securityKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No security keys registered. Please use OTP verification or add a security key first.',
        code: 'NO_SECURITY_KEYS',
      });
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      allowCredentials: securityKeys.map((key) => ({
        id: key.credentialId,
        transports: (key.transports || []) as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
      timeout: 60000, // 1 minute
    });

    // Store challenge in Redis
    await redis.setex(
      `${WEBAUTHN_CHALLENGE_PREFIX}${auth.userId}`,
      WEBAUTHN_CHALLENGE_TTL,
      options.challenge
    );

    logger.info('WebAuthn options generated for account settings verification', {
      userId: auth.userId,
      keyCount: securityKeys.length,
    });

    return res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    logger.error('WebAuthn options generation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate WebAuthn options',
    });
  }
};

/**
 * Verify WebAuthn authentication for account settings re-verification
 * POST /api/v1/account-settings/webauthn/verify
 */
export const verifyWebAuthn = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { response } = req.body as { response: AuthenticationResponseJSON };
    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'WebAuthn response required',
      });
    }

    // Get stored challenge
    const challengeKey = `${WEBAUTHN_CHALLENGE_PREFIX}${auth.userId}`;
    const expectedChallenge = await redis.get<string>(challengeKey);

    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        message: 'WebAuthn challenge expired. Please try again.',
        code: 'CHALLENGE_EXPIRED',
      });
    }

    // Find the security key by credential ID
    const securityKey = await prisma.securityKey.findUnique({
      where: { credentialId: response.id },
    });

    if (!securityKey || securityKey.userId !== auth.userId) {
      return res.status(400).json({
        success: false,
        message: 'Security key not found or does not belong to this account',
      });
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      credential: {
        id: securityKey.credentialId,
        publicKey: Buffer.from(securityKey.publicKey, 'base64url'),
        counter: Number(securityKey.counter),
        transports: (securityKey.transports || []) as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      logger.warn('WebAuthn verification failed for account settings', { userId: auth.userId });
      return res.status(400).json({
        success: false,
        message: 'WebAuthn verification failed',
      });
    }

    // Update counter to prevent replay attacks
    await prisma.securityKey.update({
      where: { id: securityKey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Delete the challenge
    await redis.del(challengeKey);

    // Generate JWT token for account settings access (same as OTP verification)
    const deviceFingerprint = {
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress || 'unknown',
    };

    const token = jwt.sign(
      {
        userId: auth.userId,
        purpose: 'account-settings',
        device: deviceFingerprint,
        method: 'webauthn', // Mark that this was verified via WebAuthn
      },
      ENV.JWT_SECRET,
      {
        expiresIn: `${TOKEN_EXPIRY_MINUTES}m`,
      }
    );

    // Set secure cookie
    res.cookie('account-settings-token', token, getAccountSettingsCookieOptions(TOKEN_EXPIRY_MINUTES));

    // Log the verification
    inngest.send({
      name: 'log.create',
      data: {
        userId: auth.userId,
        action: 'sensitive-action-verified-webauthn',
        level: 'CRITICAL',
      },
    });

    logger.info('WebAuthn verification successful for account settings', {
      userId: auth.userId,
      keyId: securityKey.id,
    });

    return res.json({
      success: true,
      message: 'Security key verification successful',
    });
  } catch (error) {
    logger.error('WebAuthn verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Security key verification failed',
    });
  }
};

/**
 * Check if user has security keys for WebAuthn re-verification
 * GET /api/v1/account-settings/webauthn/available
 */
export const checkWebAuthnAvailable = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const keyCount = await prisma.securityKey.count({
      where: { userId: auth.userId },
    });

    // Also get user preferences to determine if OTP is disabled
    const user = await prisma.user.findUnique({
      where: { userId: auth.userId },
      select: {
        disableOTPReverification: true,
      },
    });

    return res.json({
      success: true,
      data: {
        webauthnAvailable: keyCount > 0,
        securityKeyCount: keyCount,
        otpDisabled: user?.disableOTPReverification || false,
      },
    });
  } catch (error) {
    logger.error('Check WebAuthn available error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to check WebAuthn availability',
    });
  }
};
