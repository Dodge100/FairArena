/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import {
  createSession,
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  parseUserAgent,
  storeSessionBinding,
} from '../../services/auth.service.js';
import { REFRESH_TOKEN_COOKIE_OPTIONS, SESSION_COOKIE_OPTIONS } from '../../utils/cookie.utils.js';
import { formatLocationString, getLocationFromIP } from '../../utils/location.utils.js';
import logger from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface QRAuthSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'claimed' | 'expired';
  requestingDevice: {
    userAgent: string;
    ipAddress: string;
    fingerprint?: string;
  };
  // Set after approval (authorization intent, NOT credentials):
  approvedBy?: string;
  approvedAt?: number;
  scopedSessionNonce?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QR_SESSION_TTL = 60; // 60 seconds
const QR_NONCE_LENGTH = 32;

// Rate limit configs
const RATE_LIMITS = {
  generate: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  approve: { max: 10, windowMs: 5 * 60 * 1000 }, // 10 per 5 min
  claim: { max: 3, windowMs: 60 * 1000 }, // 3 per min per sessionId
  status: { max: 1, windowMs: 0 }, // 1 SSE connection per sessionId
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a cryptographically secure QR session ID
 */
function generateQRSessionId(): string {
  return `qr_${generateSecureToken(24)}`;
}

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Check rate limit for QR operations
 */
async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const windowKey = `${REDIS_KEYS.QR_AUTH_RATE_LIMIT}${key}`;

  const current = await redis.get<string>(windowKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= max) {
    const ttl = await redis.ttl(windowKey);
    return { allowed: false, remaining: 0, resetIn: ttl > 0 ? ttl : 0 };
  }

  // Increment counter
  if (count === 0) {
    await redis.setex(windowKey, Math.ceil(windowMs / 1000), '1');
  } else {
    await redis.incr(windowKey);
  }

  return { allowed: true, remaining: max - count - 1, resetIn: Math.ceil(windowMs / 1000) };
}

/**
 * Parse device info for display in approval screen
 */
async function parseDeviceInfo(
  userAgent: string,
  ipAddress: string,
): Promise<{
  browser: string;
  os: string;
  device: string;
  location: string;
}> {
  const ua = userAgent.toLowerCase();

  // Browser detection
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Device type
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }

  // Get location from IP address
  const locationData = await getLocationFromIP(ipAddress);
  const location = formatLocationString(locationData, ipAddress);

  return { browser, os, device, location };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const generateSchema = z.object({
  fingerprint: z.string().optional(),
});

const approveSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

const claimSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  nonce: z.string().min(1, 'Nonce is required'),
});

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * Generate a new QR session
 * POST /api/v1/auth/qr/generate
 *
 * Creates a temporary QR session that can be approved by an authenticated device.
 * Returns sessionId and QR data for display.
 */
export async function generateQRSession(req: Request, res: Response) {
  try {
    const clientIP = getClientIP(req);

    // Rate limit check
    const rateCheck = await checkRateLimit(
      `generate:${clientIP}`,
      RATE_LIMITS.generate.max,
      RATE_LIMITS.generate.windowMs,
    );

    if (!rateCheck.allowed) {
      logger.warn('QR generate rate limit exceeded', { ip: clientIP });
      return res.status(429).json({
        success: false,
        message: 'Too many QR code requests. Please try again later.',
        retryAfter: rateCheck.resetIn,
      });
    }

    // Validate request body
    const validation = generateSchema.safeParse(req.body || {});
    const fingerprint = validation.success ? validation.data.fingerprint : undefined;

    // Generate session
    const sessionId = generateQRSessionId();
    const now = Date.now();
    const expiresAt = now + QR_SESSION_TTL * 1000;

    const session: QRAuthSession = {
      sessionId,
      createdAt: now,
      expiresAt,
      status: 'pending',
      requestingDevice: {
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: clientIP,
        fingerprint,
      },
    };

    // Store in Redis with TTL
    const sessionKey = `${REDIS_KEYS.QR_AUTH_SESSION}${sessionId}`;
    await redis.setex(sessionKey, QR_SESSION_TTL, JSON.stringify(session));

    logger.info('QR session created', { sessionId, ip: clientIP });

    // QR data contains the session ID and a verification hash
    const qrData = JSON.stringify({
      type: 'fairarena_qr_auth',
      version: 1,
      sessionId,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        qrData,
        expiresAt,
        ttl: QR_SESSION_TTL,
      },
    });
  } catch (error) {
    logger.error('QR generate error', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
    });
  }
}

/**
 * Stream QR session status via Server-Sent Events
 * GET /api/v1/auth/qr/status/:sessionId
 *
 * Streams real-time status updates until session is approved, claimed, or expired.
 */
export async function streamQRStatus(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;

  if (!sessionId || !sessionId.startsWith('qr_')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID',
    });
  }

  // Check if SSE connection already exists for this session
  const connectionKey = `${REDIS_KEYS.QR_AUTH_RATE_LIMIT}sse:${sessionId}`;
  const existingConnection = await redis.get(connectionKey);

  if (existingConnection) {
    return res.status(429).json({
      success: false,
      message: 'SSE connection already exists for this session',
    });
  }

  // Mark SSE connection as active
  await redis.setex(connectionKey, QR_SESSION_TTL + 5, '1');

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sessionKey = `${REDIS_KEYS.QR_AUTH_SESSION}${sessionId}`;

  // Send initial status
  const sendStatus = async (): Promise<'continue' | 'stop'> => {
    try {
      const data = await redis.get(sessionKey);

      if (!data) {
        res.write(
          `data: ${JSON.stringify({ status: 'expired', message: 'Session expired or not found' })}\n\n`,
        );
        return 'stop';
      }

      const session: QRAuthSession = typeof data === 'string' ? JSON.parse(data) : data;

      // Check if expired
      if (Date.now() > session.expiresAt) {
        res.write(`data: ${JSON.stringify({ status: 'expired', message: 'Session expired' })}\n\n`);
        return 'stop';
      }

      res.write(
        `data: ${JSON.stringify({
          status: session.status,
          expiresAt: session.expiresAt,
          ttl: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
          ...(session.status === 'approved' && { nonce: session.scopedSessionNonce }),
        })}\n\n`,
      );

      // Stop polling on terminal states
      if (session.status === 'approved' || session.status === 'claimed') {
        return 'stop';
      }

      return 'continue';
    } catch (error) {
      logger.error('SSE status check error', { sessionId, error });
      res.write(`data: ${JSON.stringify({ status: 'error', message: 'Internal error' })}\n\n`);
      return 'stop';
    }
  };

  // Initial send
  const initial = await sendStatus();
  if (initial === 'stop') {
    await redis.del(connectionKey);
    return res.end();
  }

  // Poll every 500ms
  const interval = setInterval(async () => {
    const result = await sendStatus();
    if (result === 'stop') {
      clearInterval(interval);
      await redis.del(connectionKey);
      res.end();
    }
  }, 500);

  // Cleanup on client disconnect
  req.on('close', async () => {
    clearInterval(interval);
    await redis.del(connectionKey);
    logger.info('SSE connection closed', { sessionId });
  });

  // Auto-close after TTL + buffer
  setTimeout(
    async () => {
      clearInterval(interval);
      await redis.del(connectionKey);
      res.write(`data: ${JSON.stringify({ status: 'expired', message: 'Session timeout' })}\n\n`);
      res.end();
    },
    (QR_SESSION_TTL + 5) * 1000,
  );
}

/**
 * Approve QR login from authenticated device
 * POST /api/v1/auth/qr/approve
 *
 * Authenticated user approves login on the requesting device.
 * Stores authorization intent with a one-time nonce.
 */
export async function approveQRSession(req: Request, res: Response) {
  try {
    // User must be authenticated
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Rate limit check
    const rateCheck = await checkRateLimit(
      `approve:${userId}`,
      RATE_LIMITS.approve.max,
      RATE_LIMITS.approve.windowMs,
    );

    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many approval attempts. Please try again later.',
        retryAfter: rateCheck.resetIn,
      });
    }

    // Validate request
    const validation = approveSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: validation.error.issues,
      });
    }

    const { sessionId } = validation.data;

    // Get QR session from Redis
    const sessionKey = `${REDIS_KEYS.QR_AUTH_SESSION}${sessionId}`;
    const data = await redis.get(sessionKey);

    if (!data) {
      logger.warn('QR session not found for approval', { sessionId, userId });
      return res.status(404).json({
        success: false,
        message: 'QR session not found or expired',
      });
    }

    const session: QRAuthSession = typeof data === 'string' ? JSON.parse(data) : data;

    // Check if expired
    if (Date.now() > session.expiresAt) {
      await redis.del(sessionKey);
      return res.status(410).json({
        success: false,
        message: 'QR code has expired',
      });
    }

    // Check if already processed
    if (session.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Session already ${session.status}`,
      });
    }

    // Generate one-time nonce for claim
    const nonce = generateSecureToken(QR_NONCE_LENGTH);

    // Update session with approval
    session.status = 'approved';
    session.approvedBy = userId;
    session.approvedAt = Date.now();
    session.scopedSessionNonce = nonce;

    // Calculate remaining TTL
    const remainingTTL = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));

    // Store updated session
    await redis.setex(sessionKey, remainingTTL + 30, JSON.stringify(session)); // Extra 30s for claim

    // Log the approval
    logger.info('QR session approved', {
      sessionId,
      approvedBy: userId,
      requestingIP: session.requestingDevice.ipAddress,
    });

    // Parse device info for response
    const deviceInfo = await parseDeviceInfo(
      session.requestingDevice.userAgent,
      session.requestingDevice.ipAddress,
    );

    return res.status(200).json({
      success: true,
      message: 'Login approved',
      data: {
        deviceInfo,
      },
    });
  } catch (error) {
    logger.error('QR approve error', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to approve login',
    });
  }
}

/**
 * Claim session tokens after approval
 * POST /api/v1/auth/qr/claim
 *
 * Requesting device claims the approved session, receiving auth tokens.
 * Tokens are minted here, never stored in Redis.
 */
export async function claimQRSession(req: Request, res: Response) {
  try {
    // Validate request
    const validation = claimSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: validation.error.issues,
      });
    }

    const { sessionId, nonce } = validation.data;

    // Rate limit check per sessionId
    const rateCheck = await checkRateLimit(
      `claim:${sessionId}`,
      RATE_LIMITS.claim.max,
      RATE_LIMITS.claim.windowMs,
    );

    if (!rateCheck.allowed) {
      logger.warn('QR claim rate limit exceeded', { sessionId });
      return res.status(429).json({
        success: false,
        message: 'Too many claim attempts',
        retryAfter: rateCheck.resetIn,
      });
    }

    // Get QR session from Redis
    const sessionKey = `${REDIS_KEYS.QR_AUTH_SESSION}${sessionId}`;
    const data = await redis.get(sessionKey);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired',
      });
    }

    const session: QRAuthSession = typeof data === 'string' ? JSON.parse(data) : data;

    // Verify status
    if (session.status === 'claimed') {
      return res.status(409).json({
        success: false,
        message: 'Session already claimed',
      });
    }

    if (session.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Session not approved. Current status: ${session.status}`,
      });
    }

    // Verify nonce (timing-safe comparison)
    if (!session.scopedSessionNonce) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session state',
      });
    }

    const nonceMatch = crypto.timingSafeEqual(
      Buffer.from(nonce),
      Buffer.from(session.scopedSessionNonce),
    );

    if (!nonceMatch) {
      logger.warn('QR claim nonce mismatch', { sessionId });
      return res.status(403).json({
        success: false,
        message: 'Invalid nonce',
      });
    }

    // Soft fingerprint validation (log mismatch, don't block)
    const currentFingerprint = req.body.fingerprint;
    if (
      session.requestingDevice.fingerprint &&
      currentFingerprint &&
      session.requestingDevice.fingerprint !== currentFingerprint
    ) {
      logger.warn('QR claim fingerprint mismatch', {
        sessionId,
        original: session.requestingDevice.fingerprint,
        current: currentFingerprint,
      });
      // Continue anyway - soft binding
    }

    // Get the approving user
    const user = await prisma.user.findUnique({
      where: { userId: session.approvedBy },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        isBanned: true,
        banReason: true,
        superSecureAccountEnabled: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Account is banned',
        banReason: user.banReason,
      });
    }

    // Block QR-based auth for Super Secure Accounts
    if (user.superSecureAccountEnabled) {
      logger.warn('QR auth blocked for super secure account', {
        sessionId,
        userId: user.userId,
      });
      return res.status(403).json({
        success: false,
        message:
          'QR-based authentication is not available for Super Secure Accounts. Please use WebAuthn (security key) authentication.',
        code: 'SUPER_SECURE_ACCOUNT_NO_QR',
      });
    }

    // Mark session as claimed BEFORE minting tokens (atomic-ish)
    session.status = 'claimed';
    await redis.setex(sessionKey, 60, JSON.stringify(session)); // Keep for 60s for audit

    // Parse device info for session
    const { deviceType, deviceName } = parseUserAgent(session.requestingDevice.userAgent);

    // Create new auth session
    const refreshToken = generateRefreshToken();
    const authSessionId = await createSession(
      user.userId,
      refreshToken,
      {
        deviceName,
        deviceType,
        userAgent: session.requestingDevice.userAgent,
        ipAddress: session.requestingDevice.ipAddress,
      },
      { isBanned: user.isBanned, banReason: user.banReason },
    );

    // Generate binding token
    const bindingToken = generateSecureToken(32);
    const bindingHash = hashToken(bindingToken);
    await storeSessionBinding(authSessionId, bindingHash);

    // Generate access token
    const accessToken = generateAccessToken(user.userId, authSessionId);

    // Delete QR session from Redis (cleanup)
    await redis.del(sessionKey);

    logger.info('QR session claimed successfully', {
      sessionId,
      userId: user.userId,
      authSessionId,
    });

    // Set cookies
    // Set session cookie
    res.cookie(`session_${authSessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    // Set active session cookie
    res.cookie('active_session', authSessionId, SESSION_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePic: user.profileImageUrl,
        },
        accessToken,
        sessionId: authSessionId,
      },
    });
  } catch (error) {
    logger.error('QR claim error', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to complete login',
    });
  }
}

/**
 * Get device info for approval confirmation
 * POST /api/v1/auth/qr/device-info
 *
 * Returns parsed device info for the QR session to display in approval dialog.
 */
export async function getQRDeviceInfo(req: Request, res: Response) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required',
      });
    }

    const sessionKey = `${REDIS_KEYS.QR_AUTH_SESSION}${sessionId}`;
    const data = await redis.get(sessionKey);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired',
      });
    }

    const session: QRAuthSession = typeof data === 'string' ? JSON.parse(data) : data;

    const deviceInfo = await parseDeviceInfo(
      session.requestingDevice.userAgent,
      session.requestingDevice.ipAddress,
    );

    return res.status(200).json({
      success: true,
      data: {
        deviceInfo,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    logger.error('QR device info error', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to get device info',
    });
  }
}
