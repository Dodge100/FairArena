import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { Request, Response } from 'express';
import logger from './logger.js';

interface AuthPayload {
  userId?: string;
  isAuthenticated?: boolean;
}

export const Verifier = (req: Request, res: Response, auth: AuthPayload) => {
  try {
    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      purpose: string;
      device: {
        userAgent: string;
        ip: string;
      };
    };

    if (decoded.purpose !== 'account-settings' || decoded.userId !== auth.userId) {
      logger.warn('Invalid token purpose or user mismatch', {
        purpose: decoded.purpose,
        tokenUserId: decoded.userId,
        authUserId: auth.userId
      });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify device binding
    const currentUserAgent = req.headers['user-agent'] || 'unknown';
    const currentIp = req.ip || req.connection.remoteAddress || 'unknown';

    if (decoded.device.userAgent !== currentUserAgent || decoded.device.ip !== currentIp) {
      logger.warn('Device mismatch detected', {
        userId: auth.userId,
        tokenDevice: decoded.device,
        currentDevice: { userAgent: currentUserAgent, ip: currentIp }
      });
      return res.status(401).json({ success: false, message: 'Device verification failed' });
    }
  } catch (error) {
    logger.error('Token verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};
