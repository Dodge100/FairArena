import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      auth: () => {
        userId?: string;
        isAuthenticated?: boolean;
        user?: {
          primaryEmailAddress?: { emailAddress: string };
        };
      };
    }
  }
}

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - you must be logged in',
      });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', { error });
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};
