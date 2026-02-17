import { NextFunction, Request, Response } from 'express';
import { ApiKeyData, updateApiKeyLastUsed, validateApiKey } from '../services/apiKey.service.js';
import {
  extractBearerToken,
  getSession,
  updateSessionActivity,
  verifyAccessToken,
  verifySessionBinding,
} from '../services/auth.service.js';
import logger from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId: string;
      };
      apiKey?: ApiKeyData;
      apiKeyAuth?: boolean;
      userId?: string;
    }
  }
}

/**
 * Middleware to protect routes requiring authentication
 * Supports both JWT access tokens (sessions) and API Keys
 */
export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Check for API Key first (Authorization: Bearer fa_... or X-API-Key)
    let apiKeyStr: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer fa_')) {
      apiKeyStr = authHeader.substring(7);
    } else if (
      typeof req.headers['x-api-key'] === 'string' &&
      req.headers['x-api-key'].startsWith('fa_')
    ) {
      apiKeyStr = req.headers['x-api-key'];
    }

    // If API Key is present, validate it
    if (apiKeyStr) {
      const validation = await validateApiKey(apiKeyStr);

      if (!validation.valid || !validation.apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: validation.error || 'The provided API key is invalid or expired',
        });
      }

      // Valid API Key - Attach user info
      req.user = {
        userId: validation.apiKey.userId,
        sessionId: 'api-key', // Placeholder for API key auth
      };
      req.userId = validation.apiKey.userId;
      req.apiKey = validation.apiKey;
      req.apiKeyAuth = true;

      // Update last used (fire and forget)
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      updateApiKeyLastUsed(validation.apiKey.id, ipAddress).catch(() => {});

      return next();
    }

    // 2. Fallback to Standard JWT/Session Auth
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - no token or API key provided',
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

    // Check if user is banned
    if (session.isBanned) {
      logger.warn('Banned user attempted access', { userId: session.userId });
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${session.banReason || 'Violation of terms'}`,
        code: 'USER_BANNED',
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
    req.userId = payload.userId;

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

export const protectStreamRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Try standard auth first (Authorization header)
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      return protectRoute(req, res, next);
    }

    // 2. Fallback to Cookie-based Auth
    const sessionId = req.cookies?.active_session;
    if (!sessionId) {
      return res.status(401).json({ success: false, message: 'Unauthorized - No session cookie' });
    }

    // Check strict binding token
    const bindingToken = req.cookies?.[`session_${sessionId}`];
    if (!bindingToken) {
      return res.status(401).json({ success: false, message: 'Invalid session binding' });
    }

    // Verify session binding
    const isBindingValid = await verifySessionBinding(sessionId, bindingToken);
    if (!isBindingValid) {
      logger.warn('Invalid session binding attempt', { sessionId });
      return res.status(401).json({ success: false, message: 'Invalid session binding' });
    }

    // Get session
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session invalid' });
    }

    // Check ban
    if (session.isBanned) {
      return res.status(403).json({ success: false, message: 'User banned' });
    }

    // Update activity
    updateSessionActivity(sessionId).catch(() => {});

    // Attach user info
    req.user = {
      userId: session.userId,
      sessionId,
    };
    req.userId = session.userId;

    next();
  } catch (error) {
    logger.error('Stream auth error:', { error });
    return res.status(401).json({ success: false, message: 'Stream authentication failed' });
  }
};
