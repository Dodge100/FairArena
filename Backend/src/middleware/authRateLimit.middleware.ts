import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

interface RateLimitOptions {
    windowMs: number;
    max: number;
    message: string;
    keyPrefix?: string;
    keyGenerator?: (req: Request) => string;
}

const defaultKeyGenerator = (req: Request): string => {
    // Use IP address as default key
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Also include the route to make it route-specific
    const route = req.path;
    return `${ip}:${route}`;
};

/**
 * Create an auth-specific rate limiter using Redis
 * More granular than the global Arcjet rate limiter
 */
export function createAuthRateLimiter(options: RateLimitOptions) {
    const {
        windowMs,
        max,
        message,
        keyPrefix = 'auth_rl:',
        keyGenerator = defaultKeyGenerator,
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const key = `${keyPrefix}${keyGenerator(req)}`;
            const windowSeconds = Math.ceil(windowMs / 1000);

            // Get current count
            const currentStr = await redis.get<string>(key);
            const current = currentStr ? parseInt(currentStr, 10) : 0;

            if (current >= max) {
                // Get TTL for retry-after header
                const ttl = await redis.ttl(key);

                logger.warn('Rate limit exceeded', {
                    key,
                    current,
                    max,
                    path: req.path,
                    ip: req.ip,
                });

                return res.status(429).json({
                    success: false,
                    message,
                    retryAfter: ttl > 0 ? ttl : windowSeconds,
                });
            }

            // Increment counter
            if (current === 0) {
                // First request in window, set with expiry
                await redis.setex(key, windowSeconds, '1');
            } else {
                // Increment existing counter
                await redis.incr(key);
            }

            // Add rate limit headers
            const remaining = Math.max(0, max - current - 1);
            res.setHeader('X-RateLimit-Limit', max.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());
            res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + windowSeconds).toString());

            next();
        } catch (error) {
            // If Redis fails, allow the request (fail open)
            logger.error('Rate limit check failed', {
                error: error instanceof Error ? error.message : String(error),
                path: req.path,
            });
            next();
        }
    };
}

/**
 * Rate limiter that uses email as key (for password reset, etc.)
 */
export function createEmailRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
    return createAuthRateLimiter({
        ...options,
        keyGenerator: (req: Request) => {
            const email = req.body?.email?.toLowerCase() || 'unknown';
            return `email:${email}:${req.path}`;
        },
    });
}

/**
 * Rate limiter that combines IP and user ID (for authenticated routes)
 */
export function createUserRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
    return createAuthRateLimiter({
        ...options,
        keyGenerator: (req: Request) => {
            const userId = req.user?.userId || 'anon';
            const ip = req.ip || 'unknown';
            return `user:${userId}:${ip}:${req.path}`;
        },
    });
}
