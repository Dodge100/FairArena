import { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Centralized error handler middleware
 * Sanitizes error messages and provides consistent error responses
 */
export const errorHandler = (
    err: Error | any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Log the error
    logger.error('Error handler caught error', {
        error: err.message || String(err),
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId,
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Prepare error response
    const errorResponse: any = {
        success: false,
        error: getErrorType(statusCode),
        message: getErrorMessage(err, statusCode),
    };

    // Add error code if available
    if (err.code) {
        errorResponse.code = err.code;
    }

    // Add validation errors if available (from Zod or similar)
    if (err.errors && Array.isArray(err.errors)) {
        errorResponse.errors = err.errors;
    }

    // In development, include stack trace
    if (ENV.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.details = err.details || {};
    }

    // Set security headers even for error responses
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    // Send error response
    res.status(statusCode).json(errorResponse);
};

/**
 * Get error type based on status code
 */
function getErrorType(statusCode: number): string {
    switch (statusCode) {
        case 400:
            return 'Bad Request';
        case 401:
            return 'Unauthorized';
        case 403:
            return 'Forbidden';
        case 404:
            return 'Not Found';
        case 409:
            return 'Conflict';
        case 413:
            return 'Payload Too Large';
        case 415:
            return 'Unsupported Media Type';
        case 422:
            return 'Unprocessable Entity';
        case 429:
            return 'Too Many Requests';
        case 500:
            return 'Internal Server Error';
        case 502:
            return 'Bad Gateway';
        case 503:
            return 'Service Unavailable';
        default:
            return 'Error';
    }
}

/**
 * Get sanitized error message
 * In production, don't expose internal error details
 */
function getErrorMessage(err: any, statusCode: number): string {
    // In production, use generic messages for 500 errors
    if (ENV.NODE_ENV === 'production' && statusCode >= 500) {
        return 'An internal server error occurred. Please try again later.';
    }

    // For client errors (4xx), use the error message if available
    if (err.message && statusCode < 500) {
        // Sanitize the message to prevent information leakage
        return sanitizeErrorMessage(err.message);
    }

    // Default messages
    return getDefaultErrorMessage(statusCode);
}

/**
 * Sanitize error message to prevent information leakage
 */
function sanitizeErrorMessage(message: string): string {
    // Remove file paths
    message = message.replace(/\/[^\s]+/g, '[path]');

    // Remove potential SQL queries
    message = message.replace(/SELECT|INSERT|UPDATE|DELETE|DROP/gi, '[query]');

    // Truncate very long messages
    if (message.length > 200) {
        message = message.substring(0, 200) + '...';
    }

    return message;
}

/**
 * Get default error message for status code
 */
function getDefaultErrorMessage(statusCode: number): string {
    switch (statusCode) {
        case 400:
            return 'The request was invalid or cannot be served.';
        case 401:
            return 'Authentication is required to access this resource.';
        case 403:
            return 'You do not have permission to access this resource.';
        case 404:
            return 'The requested resource was not found.';
        case 409:
            return 'The request conflicts with the current state of the server.';
        case 413:
            return 'The request payload is too large.';
        case 415:
            return 'The media type is not supported.';
        case 422:
            return 'The request was well-formed but contains semantic errors.';
        case 429:
            return 'Too many requests. Please try again later.';
        case 500:
            return 'An internal server error occurred.';
        case 502:
            return 'Bad gateway.';
        case 503:
            return 'The service is temporarily unavailable.';
        default:
            return 'An error occurred while processing your request.';
    }
}

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
    logger.info('404 Not Found', {
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found.',
        code: 'RESOURCE_NOT_FOUND',
    });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
