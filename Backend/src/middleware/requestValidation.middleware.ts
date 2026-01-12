import { NextFunction, Request, Response } from 'express';
import { REQUEST_VALIDATION_CONFIG } from '../config/security.config.js';
import logger from '../utils/logger.js';
import {
    detectCommandInjection,
    detectPathTraversal,
    detectSqlInjection,
    detectXss,
    sanitizeObject,
} from '../utils/sanitization.utils.js';

/**
 * Middleware to validate request size
 */
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check URL length
        if (req.url.length > REQUEST_VALIDATION_CONFIG.maxUrlLength) {
            logger.warn('Request URL too long', {
                length: req.url.length,
                max: REQUEST_VALIDATION_CONFIG.maxUrlLength,
                ip: req.ip,
            });

            return res.status(414).json({
                success: false,
                error: 'URL too long',
                message: 'Request URL exceeds maximum allowed length',
            });
        }

        next();
    } catch (error) {
        logger.error('Error in validateRequestSize middleware', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};

/**
 * Middleware to validate Content-Type header
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Skip validation for GET, HEAD, OPTIONS requests
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }

        const contentType = req.headers['content-type'];

        // If no content type and no body, allow
        if (!contentType && !req.body) {
            return next();
        }

        // Check if content type is allowed
        if (contentType) {
            const baseContentType = contentType.split(';')[0].trim();
            const isAllowed = REQUEST_VALIDATION_CONFIG.allowedContentTypes.some((allowed) =>
                baseContentType.includes(allowed)
            );

            if (!isAllowed) {
                logger.warn('Invalid Content-Type', {
                    contentType: baseContentType,
                    path: req.path,
                    ip: req.ip,
                });

                return res.status(415).json({
                    success: false,
                    error: 'Unsupported Media Type',
                    message: 'Content-Type not allowed',
                });
            }
        }

        next();
    } catch (error) {
        logger.error('Error in validateContentType middleware', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};

/**
 * Middleware to sanitize request inputs
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            const sanitizedQuery = sanitizeObject(req.query as Record<string, any>);
            // Update properties individually to avoid overriding getter-only req.query
            for (const key in sanitizedQuery) {
                if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                    (req.query as any)[key] = sanitizedQuery[key];
                }
            }
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }

        // Sanitize request body (if it's an object)
        if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
            req.body = sanitizeObject(req.body);
        }

        next();
    } catch (error) {
        logger.error('Error in sanitizeRequest middleware', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};

/**
 * Middleware to detect injection attacks
 */
export const detectInjectionAttacks = (req: Request, res: Response, next: NextFunction) => {
    try {
        const checkValue = (value: any, path: string): boolean => {
            if (typeof value === 'string') {
                // Check for SQL injection
                if (detectSqlInjection(value)) {
                    logger.warn('SQL injection attempt detected', {
                        path,
                        value: value.substring(0, 100), // Log first 100 chars
                        ip: req.ip,
                        url: req.url,
                    });
                    return true;
                }

                // Check for XSS
                if (detectXss(value)) {
                    logger.warn('XSS attempt detected', {
                        path,
                        value: value.substring(0, 100),
                        ip: req.ip,
                        url: req.url,
                    });
                    return true;
                }

                // Check for path traversal
                if (detectPathTraversal(value)) {
                    logger.warn('Path traversal attempt detected', {
                        path,
                        value: value.substring(0, 100),
                        ip: req.ip,
                        url: req.url,
                    });
                    return true;
                }

                // Check for command injection
                if (detectCommandInjection(value)) {
                    logger.warn('Command injection attempt detected', {
                        path,
                        value: value.substring(0, 100),
                        ip: req.ip,
                        url: req.url,
                    });
                    return true;
                }
            } else if (typeof value === 'object' && value !== null) {
                for (const key in value) {
                    if (checkValue(value[key], `${path}.${key}`)) {
                        return true;
                    }
                }
            }

            return false;
        };

        // Check query parameters
        if (req.query && checkValue(req.query, 'query')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Potentially malicious input detected',
                code: 'INJECTION_DETECTED',
            });
        }

        // Check URL parameters
        if (req.params && checkValue(req.params, 'params')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Potentially malicious input detected',
                code: 'INJECTION_DETECTED',
            });
        }

        // Check request body
        if (req.body && checkValue(req.body, 'body')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Potentially malicious input detected',
                code: 'INJECTION_DETECTED',
            });
        }

        next();
    } catch (error) {
        logger.error('Error in detectInjectionAttacks middleware', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};

/**
 * Combined request validation middleware
 */
export const requestValidation = [
    validateRequestSize,
    validateContentType,
    sanitizeRequest,
    detectInjectionAttacks,
];
