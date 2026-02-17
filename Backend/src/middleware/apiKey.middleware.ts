import { NextFunction, Request, Response } from 'express';
import { ApiKeyData, updateApiKeyLastUsed, validateApiKey } from '../services/apiKey.service.js';
import logger from '../utils/logger.js';

// Extend Express Request to include API key data
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyData;
      apiKeyAuth?: boolean;
      userId?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using API key
 * Supports both header-based and query parameter authentication
 *
 * Usage:
 * - Header: `Authorization: Bearer fa_live_xxx` or `X-API-Key: fa_live_xxx`
 * - Query: `?api_key=fa_live_xxx` (not recommended for production)
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract API key from various sources
    let apiKey: string | undefined;

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('fa_')) {
        apiKey = token;
      }
    }

    // 2. Check X-API-Key header
    if (!apiKey) {
      const xApiKey = req.headers['x-api-key'];
      if (typeof xApiKey === 'string' && xApiKey.startsWith('fa_')) {
        apiKey = xApiKey;
      }
    }

    // 3. Check query parameter (less secure, for testing only)
    if (!apiKey && req.query.api_key) {
      const queryKey = req.query.api_key as string;
      if (queryKey.startsWith('fa_')) {
        apiKey = queryKey;
        // Log warning for using query parameter auth in production
        if (process.env.NODE_ENV === 'production') {
          logger.warn('API key passed in query parameter', {
            ip: req.ip,
            path: req.path,
          });
        }
      }
    }

    // No API key provided
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Please provide a valid API key via Authorization header or X-API-Key header',
      });
      return;
    }

    // Validate the API key
    const validationResult = await validateApiKey(apiKey);

    if (!validationResult.valid || !validationResult.apiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: validationResult.error || 'The provided API key is invalid or expired',
      });
      return;
    }

    // Attach API key data to request
    req.apiKey = validationResult.apiKey;
    req.apiKeyAuth = true;
    req.userId = validationResult.apiKey.userId;

    // Update last used timestamp asynchronously (fire and forget)
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    updateApiKeyLastUsed(validationResult.apiKey.id, ipAddress).catch(() => {
      // Ignore errors - this is non-critical
    });

    logger.debug('API key authenticated', {
      keyId: validationResult.apiKey.id,
      keyPrefix: validationResult.apiKey.keyPrefix,
      userId: validationResult.apiKey.userId,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('API key auth error', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Middleware that allows both session auth and API key auth
 * Useful for endpoints that should work with both authentication methods
 */
export const optionalApiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Check if already authenticated via session
  if (req.userId) {
    return next();
  }

  // Try to extract API key
  let apiKey: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('fa_')) {
      apiKey = token;
    }
  }

  if (!apiKey) {
    const xApiKey = req.headers['x-api-key'];
    if (typeof xApiKey === 'string' && xApiKey.startsWith('fa_')) {
      apiKey = xApiKey;
    }
  }

  // If no API key, just continue (let session auth handle it)
  if (!apiKey) {
    return next();
  }

  // Validate API key
  const validationResult = await validateApiKey(apiKey);

  if (validationResult.valid && validationResult.apiKey) {
    req.apiKey = validationResult.apiKey;
    req.apiKeyAuth = true;
    req.userId = validationResult.apiKey.userId;

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    updateApiKeyLastUsed(validationResult.apiKey.id, ipAddress).catch(() => {});
  }

  next();
};
