import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { SECURITY_HEADERS_CONFIG } from '../config/security.config.js';

/**
 * Enhanced security headers middleware
 * Builds on top of Helmet with stricter policies
 */
export const securityHeaders = [
    // Use Helmet with enhanced configuration
    helmet({
        // Strict Transport Security (HSTS)
        hsts: {
            maxAge: SECURITY_HEADERS_CONFIG.hsts.maxAge,
            includeSubDomains: SECURITY_HEADERS_CONFIG.hsts.includeSubDomains,
            preload: SECURITY_HEADERS_CONFIG.hsts.preload,
        },

        // Content Security Policy
        contentSecurityPolicy: {
            directives: SECURITY_HEADERS_CONFIG.csp.directives,
        },

        // X-Frame-Options
        frameguard: {
            action: 'deny',
        },

        // X-Content-Type-Options
        noSniff: true,

        // X-XSS-Protection (legacy, but still useful for older browsers)
        xssFilter: true,

        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },

        // Hide X-Powered-By header
        hidePoweredBy: true,

        // DNS Prefetch Control
        dnsPrefetchControl: {
            allow: false,
        },

        // Download Options for IE8+
        ieNoOpen: true,


    }),

    // Add custom security headers
    (req: Request, res: Response, next: NextFunction) => {
        // Permissions Policy (formerly Feature Policy)
        const permissionsPolicy = Object.entries(SECURITY_HEADERS_CONFIG.permissionsPolicy)
            .map(([feature, allowlist]) => {
                if (allowlist.length === 0) {
                    return `${feature}=()`;
                }
                return `${feature}=(${allowlist.join(' ')})`;
            })
            .join(', ');

        res.setHeader('Permissions-Policy', permissionsPolicy);

        // X-Request-ID for request tracing
        const requestId = req.headers['x-request-id'] || generateRequestId();
        res.setHeader('X-Request-ID', requestId as string);



        next();
    },
];

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Middleware to add security headers to error responses
 */
export const errorSecurityHeaders = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Ensure security headers are present even in error responses
    if (!res.headersSent) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    next(err);
};
