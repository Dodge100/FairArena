import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';

// Rate limit configuration
const RATE_LIMITS = {
  perUser: {
    perMinute: 10,
    perHour: 100,
    perDay: 500,
  },
  perDevice: {
    perMinute: 5,
    perHour: 50,
  },
  global: {
    perSecond: 1000,
    perMinute: 50000,
  },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Check and enforce rate limit for notifications
 */
export async function checkNotificationRateLimit(
  userId: string,
  deviceId?: string,
): Promise<RateLimitResult> {
  try {
    // Check user rate limit (per minute)
    const userKey = `${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:minute`;
    const userCount = await redis.incr(userKey);

    if (userCount === 1) {
      await redis.expire(userKey, 60); // 1 minute
    }

    if (userCount > RATE_LIMITS.perUser.perMinute) {
      const ttl = await redis.ttl(userKey);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        retryAfter: ttl,
      };
    }

    // Check device rate limit if provided
    if (deviceId) {
      const deviceKey = `${REDIS_KEYS.RATE_LIMIT}:notification:device:${deviceId}:minute`;
      const deviceCount = await redis.incr(deviceKey);

      if (deviceCount === 1) {
        await redis.expire(deviceKey, 60);
      }

      if (deviceCount > RATE_LIMITS.perDevice.perMinute) {
        const ttl = await redis.ttl(deviceKey);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + ttl * 1000),
          retryAfter: ttl,
        };
      }
    }

    // Check global rate limit
    const globalKey = `${REDIS_KEYS.RATE_LIMIT}:notification:global:second`;
    const globalCount = await redis.incr(globalKey);

    if (globalCount === 1) {
      await redis.expire(globalKey, 1);
    }

    if (globalCount > RATE_LIMITS.global.perSecond) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 1000),
        retryAfter: 1,
      };
    }

    return {
      allowed: true,
      remaining: RATE_LIMITS.perUser.perMinute - userCount,
      resetAt: new Date(Date.now() + (await redis.ttl(userKey)) * 1000),
    };
  } catch (error) {
    logger.error('Error checking notification rate limit', { error, userId, deviceId });
    // On error, allow the notification to maintain availability
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(Date.now() + 60000),
    };
  }
}

/**
 * Check hourly rate limit for a user
 */
export async function checkHourlyRateLimit(userId: string): Promise<boolean> {
  try {
    const key = `${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:hour`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour
    }

    return count <= RATE_LIMITS.perUser.perHour;
  } catch (error) {
    logger.error('Error checking hourly rate limit', { error, userId });
    return true;
  }
}

/**
 * Check daily rate limit for a user
 */
export async function checkDailyRateLimit(userId: string): Promise<boolean> {
  try {
    const key = `${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:day`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 86400); // 24 hours
    }

    return count <= RATE_LIMITS.perUser.perDay;
  } catch (error) {
    logger.error('Error checking daily rate limit', { error, userId });
    return true;
  }
}

/**
 * Get user's current rate limit status
 */
export async function getUserRateLimitStatus(userId: string): Promise<{
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  minuteRemaining: number;
  hourRemaining: number;
  dayRemaining: number;
}> {
  try {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      redis.get(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:minute`),
      redis.get(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:hour`),
      redis.get(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:day`),
    ]);

    const minute = parseInt(String(minuteCount || '0'));
    const hour = parseInt(String(hourCount || '0'));
    const day = parseInt(String(dayCount || '0'));

    return {
      minuteCount: minute,
      hourCount: hour,
      dayCount: day,
      minuteRemaining: Math.max(0, RATE_LIMITS.perUser.perMinute - minute),
      hourRemaining: Math.max(0, RATE_LIMITS.perUser.perHour - hour),
      dayRemaining: Math.max(0, RATE_LIMITS.perUser.perDay - day),
    };
  } catch (error) {
    logger.error('Error getting user rate limit status', { error, userId });
    return {
      minuteCount: 0,
      hourCount: 0,
      dayCount: 0,
      minuteRemaining: RATE_LIMITS.perUser.perMinute,
      hourRemaining: RATE_LIMITS.perUser.perHour,
      dayRemaining: RATE_LIMITS.perUser.perDay,
    };
  }
}

/**
 * Reset rate limits for a user (admin function)
 */
export async function resetUserRateLimits(userId: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:minute`),
      redis.del(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:hour`),
      redis.del(`${REDIS_KEYS.RATE_LIMIT}:notification:user:${userId}:day`),
    ]);

    logger.info('User rate limits reset', { userId });
  } catch (error) {
    logger.error('Error resetting user rate limits', { error, userId });
  }
}

/**
 * Implement token bucket algorithm for burst handling
 */
export async function checkTokenBucket(
  key: string,
  maxTokens: number,
  refillRate: number,
  refillInterval: number,
): Promise<boolean> {
  try {
    const now = Date.now();
    const bucketKey = `${REDIS_KEYS.RATE_LIMIT}:bucket:${key}`;

    const data = await redis.get(bucketKey);
    let tokens = maxTokens;
    let lastRefill = now;

    if (data) {
      const parsed = JSON.parse(String(data));
      tokens = parsed.tokens;
      lastRefill = parsed.lastRefill;

      // Calculate tokens to add based on time passed
      const timePassed = now - lastRefill;
      const intervalsPassed = Math.floor(timePassed / refillInterval);
      const tokensToAdd = intervalsPassed * refillRate;

      tokens = Math.min(maxTokens, tokens + tokensToAdd);
      lastRefill = now;
    }

    // Try to consume a token
    if (tokens >= 1) {
      tokens -= 1;
      await redis.setex(
        bucketKey,
        Math.ceil(refillInterval / 1000),
        JSON.stringify({ tokens, lastRefill }),
      );
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking token bucket', { error, key });
    return true; // Fail open
  }
}
