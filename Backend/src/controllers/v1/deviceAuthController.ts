import { randomBytes, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import {
  createSession,
  generateAccessToken,
  generateRefreshToken,
  parseUserAgent,
} from '../../services/auth.service.js';
import logger from '../../utils/logger.js';

interface DeviceAuthData {
  deviceCode: string;
  userCode: string;
  status: 'pending' | 'approved' | 'denied';
  userId?: string;
  clientId?: string;
  expiresAt: number;
}

/**
 * Initiate Device Authorization Flow
 * POST /api/v1/auth/device/code
 */
export const initiateDeviceAuth = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;

    // Generate codes
    const deviceCode = randomUUID();
    // Generate an 8-character user code (e.g., QWERT-1234)
    const userCodeBytes = randomBytes(4).toString('hex').toUpperCase();
    const userCode = `${userCodeBytes.substring(0, 4)}-${userCodeBytes.substring(4, 8)}`;

    const expiresIn = ENV.OAUTH_DEVICE_CODE_EXPIRY || 600; // 10 minutes
    const expiresAt = Date.now() + expiresIn * 1000;

    const data: DeviceAuthData = {
      deviceCode,
      userCode,
      status: 'pending',
      clientId,
      expiresAt,
    };

    // Store in Redis
    // Key by Device Code (for polling)
    await redis.setex(
      `${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`,
      expiresIn,
      JSON.stringify(data),
    );

    // Key by User Code (for verification)
    await redis.setex(`${REDIS_KEYS.DEVICE_AUTH_USER}${userCode}`, expiresIn, deviceCode);

    return res.status(200).json({
      success: true,
      data: {
        deviceCode,
        userCode,
        verificationUri: `${ENV.FRONTEND_URL}/device`,
        verificationUriComplete: `${ENV.FRONTEND_URL}/device?user_code=${userCode}`,
        expiresIn,
        interval: ENV.OAUTH_DEVICE_POLL_INTERVAL || 5,
      },
    });
  } catch (error) {
    logger.error('Failed to initiate device auth', { error });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Poll for Device Token
 * POST /api/v1/auth/device/token
 */
export const pollDeviceToken = async (req: Request, res: Response) => {
  try {
    const { deviceCode } = req.body;

    if (!deviceCode) {
      return res.status(400).json({ success: false, message: 'Device code required' });
    }

    // Check Redis
    const dataStr = await redis.get<string>(`${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`);

    if (!dataStr) {
      return res.status(400).json({
        success: false,
        error: 'expired_token',
        message: 'Device code expired or invalid',
      });
    }

    const data: DeviceAuthData = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;

    if (data.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'authorization_pending',
        message: 'Authorization pending',
      });
    }

    if (data.status === 'denied') {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'Authorization denied',
      });
    }

    if (data.status === 'approved' && data.userId) {
      // Generate tokens
      const user = await prisma.user.findUnique({ where: { userId: data.userId } });
      if (!user) {
        return res.status(500).json({ success: false, message: 'User not found' });
      }

      const userAgent = (req.headers['user-agent'] as string) || 'Unknown Device';
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const { deviceType: detectedDeviceType, deviceName } = parseUserAgent(userAgent);

      // Create session
      const refreshToken = generateRefreshToken();
      const sessionId = await createSession(user.userId, refreshToken, {
        deviceName: deviceName || 'FairArena App',
        deviceType: detectedDeviceType || 'mobile', // Assumed for device flow usually
        userAgent,
        ipAddress,
      });

      const accessToken = generateAccessToken(user.userId, sessionId);

      // Cleanup Redis keys
      await redis.del(`${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`);
      await redis.del(`${REDIS_KEYS.DEVICE_AUTH_USER}${data.userCode}`);

      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresIn: ENV.ACCESS_TOKEN_EXPIRY,
          tokenType: 'Bearer',
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid state' });
  } catch (error) {
    logger.error('Failed to poll device token', { error });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Verify User Code (Web Interface)
 * POST /api/v1/auth/device/verify
 */
export const verifyDeviceUserCode = async (req: Request, res: Response) => {
  try {
    const { userCode } = req.body;

    if (!userCode) {
      return res.status(400).json({ success: false, message: 'User code required' });
    }

    const normalizedCode = userCode.toUpperCase();
    const deviceCode = await redis.get<string>(`${REDIS_KEYS.DEVICE_AUTH_USER}${normalizedCode}`);

    if (!deviceCode) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    return res.status(200).json({ success: true, message: 'Code valid', deviceCode });
  } catch (error) {
    logger.error('Failed to verify user code', { error });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Approve Device Authorization
 * POST /api/v1/auth/device/approve
 */
export const approveDeviceAuth = async (req: Request, res: Response) => {
  try {
    const { userCode, approve } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!userCode) {
      return res.status(400).json({ success: false, message: 'User code required' });
    }

    const normalizedCode = userCode.toUpperCase();
    const deviceCode = await redis.get<string>(`${REDIS_KEYS.DEVICE_AUTH_USER}${normalizedCode}`);

    if (!deviceCode) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    // Get current data
    const dataStr = await redis.get<string>(`${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`);
    if (!dataStr) {
      return res.status(400).json({ success: false, message: 'Invalid session' });
    }

    const data: DeviceAuthData = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;

    if (approve) {
      data.status = 'approved';
      data.userId = userId;
    } else {
      data.status = 'denied';
    }

    // Update Redis
    // Keeps original TTL roughly, or reset to allow time to poll?
    // Usually keep existing expiration.
    const ttl = await redis.ttl(`${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`);
    if (ttl > 0) {
      await redis.setex(`${REDIS_KEYS.DEVICE_AUTH_CODE}${deviceCode}`, ttl, JSON.stringify(data));
    }

    return res.status(200).json({
      success: true,
      message: approve ? 'Device authorized' : 'Device authorization denied',
    });
  } catch (error) {
    logger.error('Failed to approve device auth', { error });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
