import { NextFunction, Request, Response } from 'express';
import { REQUEST_VALIDATION_CONFIG } from '../config/security.config.js';
import logger from '../utils/logger.js';
import {
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
 * Combined request validation middleware
 */
export const requestValidation = [
    validateRequestSize,
    validateContentType,
    sanitizeRequest,
];
