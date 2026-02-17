import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { CSRF_CONFIG } from '../config/security.config.js';
import logger from '../utils/logger.js';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
}

/**
 * Middleware to generate and set CSRF token
 * This should be applied early in the middleware chain
 */
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if token already exists in cookie
    let token = req.cookies?.[CSRF_CONFIG.cookieName];

    // Generate new token if not present
    if (!token) {
      token = generateCsrfToken();

      // Set the token in a cookie
      res.cookie(CSRF_CONFIG.cookieName, token, CSRF_CONFIG.cookieOptions);

      logger.debug('Generated new CSRF token', {
        ip: req.ip,
        path: req.path,
      });
    }

    // Make token available to the response for client-side access
    // Send it in a header so the client can read it
    res.setHeader('X-CSRF-Token', token);

    next();
  } catch (error) {
    logger.error('Error in setCsrfToken middleware', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

/**
 * Check if the request path is exempt from CSRF protection
 */
function isExemptPath(path: string): boolean {
  return CSRF_CONFIG.exemptPaths.some((exemptPath) => path.startsWith(exemptPath));
}

/**
 * Check if the HTTP method is safe (doesn't require CSRF protection)
 */
function isSafeMethod(method: string): boolean {
  return CSRF_CONFIG.safeMethods.includes(method.toUpperCase());
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * This should be applied to routes that modify data
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip CSRF validation for safe methods
    if (isSafeMethod(req.method)) {
      return next();
    }

    // Skip CSRF validation for exempt paths
    if (isExemptPath(req.path)) {
      return next();
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[CSRF_CONFIG.cookieName];

    // Get token from header
    const headerToken = req.headers[CSRF_CONFIG.headerName] as string | undefined;

    // Validate that both tokens exist
    if (!cookieToken || !headerToken) {
      logger.warn('CSRF token missing', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
      });

      return res.status(403).json({
        success: false,
        error: 'CSRF token missing',
        message: 'CSRF protection requires a valid token',
        code: 'CSRF_TOKEN_MISSING',
      });
    }

    // Validate that tokens match (Double Submit Cookie pattern)
    // Use timing-safe comparison to prevent timing attacks
    const tokensMatch = crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

    if (!tokensMatch) {
      logger.warn('CSRF token mismatch', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: 'CSRF token invalid',
        message: 'CSRF token validation failed',
        code: 'CSRF_TOKEN_INVALID',
      });
    }

    // Token is valid - rotate it for added security
    const newToken = generateCsrfToken();
    res.cookie(CSRF_CONFIG.cookieName, newToken, CSRF_CONFIG.cookieOptions);
    res.setHeader('X-CSRF-Token', newToken);

    logger.debug('CSRF token validated and rotated', {
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error('Error in validateCsrfToken middleware', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
    });

    // On error, deny the request for security
    return res.status(403).json({
      success: false,
      error: 'CSRF validation error',
      message: 'An error occurred during CSRF validation',
      code: 'CSRF_VALIDATION_ERROR',
    });
  }
};

/**
 * Combined CSRF middleware that sets and validates tokens
 * Use this for routes that need both setting and validation
 */
export const csrfProtection = [setCsrfToken, validateCsrfToken];
