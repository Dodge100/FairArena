import { NextFunction, Request, Response } from 'express';
import { AccessTokenPayload, verifyAccessToken } from '../services/oauthProvider.service.js';
import logger from '../utils/logger.js';

// Extend Express Request to include OAuth token
declare global {
    namespace Express {
        interface Request {
            oauthToken?: AccessTokenPayload;
        }
    }
}

/**
 * Validate Bearer token for resource access
 */
export async function oauthBearerAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'invalid_token',
            error_description: 'Bearer token required',
        });
        return;
    }

    const token = authHeader.slice(7);

    if (!token) {
        res.status(401).json({
            error: 'invalid_token',
            error_description: 'Empty token',
        });
        return;
    }

    try {
        const payload = await verifyAccessToken(token);

        if (!payload) {
            res.status(401).json({
                error: 'invalid_token',
                error_description: 'Token is invalid or expired',
            });
            return;
        }

        // Attach token payload to request
        req.oauthToken = payload;
        next();
    } catch (error) {
        logger.warn('Bearer token verification failed', { error });
        res.status(401).json({
            error: 'invalid_token',
            error_description: 'Token verification failed',
        });
    }
}

/**
 * Require specific scope in the Bearer token
 */
export function requireScope(requiredScope: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.oauthToken) {
            res.status(401).json({
                error: 'invalid_token',
                error_description: 'No token present',
            });
            return;
        }

        const tokenScopes = req.oauthToken.scope.split(' ');
        if (!tokenScopes.includes(requiredScope)) {
            res.status(403).json({
                error: 'insufficient_scope',
                error_description: `Required scope: ${requiredScope}`,
                scope: requiredScope,
            });
            return;
        }

        next();
    };
}
