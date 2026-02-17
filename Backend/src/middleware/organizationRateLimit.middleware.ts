import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Redis key prefix
  message?: string; // Custom error message
}

/**
 * Rate limiting configurations for different organization operations
 */
export const ORGANIZATION_RATE_LIMITS = {
  CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // Max 5 organizations per hour
    keyPrefix: 'ratelimit:org:create:',
    message: 'Too many organizations created. Please try again later.',
  },
  UPDATE: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // Max 10 updates per 5 minutes
    keyPrefix: 'ratelimit:org:update:',
    message: 'Too many update requests. Please try again later.',
  },
  DELETE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // Max 3 deletions per hour
    keyPrefix: 'ratelimit:org:delete:',
    message: 'Too many deletion requests. Please try again later.',
  },
  READ: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // Max 60 reads per minute
    keyPrefix: 'ratelimit:org:read:',
    message: 'Too many requests. Please slow down.',
  },
  AUDIT_LOGS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // Max 30 requests per minute
    keyPrefix: 'ratelimit:org:audit:',
    message: 'Too many audit log requests. Please slow down.',
  },
} as const;

/**
 * Generic rate limiter middleware factory
 */
export const createRateLimiter = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.user;
      const userId = auth?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `${config.keyPrefix}${userId}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Use Redis sorted set to track requests with timestamps
      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, { score: now, member: `${now}` });

      // Count requests in current window
      multi.zcard(key);

      // Set expiry on the key
      multi.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await multi.exec();

      // The count is the 3rd command (index 2)
      const count = results[2] as number;

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
      res.setHeader('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());

      if (count > config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          userId,
          endpoint: req.path,
          count,
          limit: config.maxRequests,
        });

        return res.status(429).json({
          error: config.message || 'Too many requests',
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', {
        error: (error as Error).message,
        userId: req.user?.userId,
      });
      // Fail open - don't block requests if rate limiter fails
      next();
    }
  };
};

/**
 * Pre-configured rate limiters for organization endpoints
 */
export const rateLimiters = {
  createOrganization: createRateLimiter(ORGANIZATION_RATE_LIMITS.CREATE),
  updateOrganization: createRateLimiter(ORGANIZATION_RATE_LIMITS.UPDATE),
  deleteOrganization: createRateLimiter(ORGANIZATION_RATE_LIMITS.DELETE),
  readOrganization: createRateLimiter(ORGANIZATION_RATE_LIMITS.READ),
  auditLogs: createRateLimiter(ORGANIZATION_RATE_LIMITS.AUDIT_LOGS),
};

/**
 * Clear rate limit for a specific user and operation
 */
export const clearRateLimit = async (
  userId: string,
  operation: keyof typeof ORGANIZATION_RATE_LIMITS,
) => {
  try {
    const config = ORGANIZATION_RATE_LIMITS[operation];
    const key = `${config.keyPrefix}${userId}`;
    await redis.del(key);
    logger.info('Cleared rate limit', { userId, operation });
  } catch (error) {
    logger.warn('Failed to clear rate limit', {
      error: (error as Error).message,
      userId,
      operation,
    });
  }
};
