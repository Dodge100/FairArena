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
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use sliding window algorithm for more accurate rate limiting
      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });

      // Set expiry
      multi.expire(key, windowSeconds);

      const results = await multi.exec();

      if (!results) {
        // If Redis fails, allow the request (fail open)
        logger.warn('Rate limit check failed - Redis multi exec returned null', {
          path: req.path,
        });
        return next();
      }

      // Get count from results (index 1 is the zcard result)
      const count = (results[1] as number) || 0;

      if (count >= max) {
        // Get TTL for retry-after header
        const ttl = await redis.ttl(key);

        logger.warn('Rate limit exceeded', {
          key,
          current: count,
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

      // Add rate limit headers
      const remaining = Math.max(0, max - count - 1);
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());

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
