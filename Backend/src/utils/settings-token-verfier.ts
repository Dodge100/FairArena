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
    };

    if (decoded.purpose !== 'account-settings' || decoded.userId !== auth.userId) {
      logger.warn('Invalid token purpose', { purpose: decoded.purpose });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  } catch (error) {
    logger.error('Token verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};
