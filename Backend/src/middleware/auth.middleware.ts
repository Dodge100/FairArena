import { NextFunction, Request, Response } from 'express';
import {
  extractBearerToken,
  getSession,
  updateSessionActivity,
  verifyAccessToken,
} from '../services/auth.service.js';
import logger from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

/**
 * Middleware to protect routes requiring authentication
 * Validates JWT access token and attaches user info to request
 */
export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - no token provided',
      });
    }

    // Verify the access token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';

      if (message === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Verify session is still valid in Redis
    const session = await getSession(payload.sessionId);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
        code: 'SESSION_INVALID',
      });
    }

    // Verify session belongs to the user in the token
    if (session.userId !== payload.userId) {
      logger.warn('Session user mismatch', {
        tokenUserId: payload.userId,
        sessionUserId: session.userId,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid session',
      });
    }

    // Update session activity (non-blocking)
    updateSessionActivity(payload.sessionId).catch((err) => {
      logger.error('Failed to update session activity', { error: err.message });
    });

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is valid, but doesn't require it
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      const session = await getSession(payload.sessionId);

      if (session && session.userId === payload.userId) {
        req.user = {
          userId: payload.userId,
          sessionId: payload.sessionId,
        };
      }
    } catch {
      // Token invalid, continue without auth
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
};
