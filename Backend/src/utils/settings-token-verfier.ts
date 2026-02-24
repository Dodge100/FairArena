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

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import logger from './logger.js';

interface AuthPayload {
  userId?: string;
  isAuthenticated?: boolean;
}

export const Verifier = (req: Request, res: Response, auth: AuthPayload) => {
  try {
    const token = req.cookies['account-settings-token'];
    if (!token) {
      throw new Error('Unauthorized');
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
        authUserId: auth.userId,
      });
      throw new Error('Unauthorized');
    }

    // Verify device binding
    const currentUserAgent = req.headers['user-agent'] || 'unknown';
    const currentIp = req.ip || req.connection.remoteAddress || 'unknown';

    if (decoded.device.userAgent !== currentUserAgent || decoded.device.ip !== currentIp) {
      logger.warn('Device mismatch detected', {
        userId: auth.userId,
        tokenDevice: decoded.device,
        currentDevice: { userAgent: currentUserAgent, ip: currentIp },
      });
      throw new Error('Device verification failed');
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      throw new Error('Unauthorized');
    }
    if (
      error instanceof Error &&
      error.message !== 'Unauthorized' &&
      error.message !== 'Device verification failed'
    ) {
      logger.error('Token verification error', {
        error: error.message,
      });
      throw new Error('Unauthorized');
    }
    throw error;
  }
};
