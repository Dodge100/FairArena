import { Request, Response } from 'express';
import { z } from 'zod';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { getUserCreditBalance, getUserCreditHistory } from '../../services/v1/creditService.js';
import logger from '../../utils/logger.js';

const creditHistoryQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  type: z.string().optional(),
});

// Cache configuration
const CACHE_TTL = {
  USER_CREDITS: 3600, // 1 hour
  USER_CREDIT_HISTORY: 1800, // 30 minutes
} as const;

export const getCreditBalance = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cacheKey = `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`;

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.info('Returning cached credit balance', { userId });
        const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json(parsedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for credit balance', { error, userId });
    }

    const balance = await getUserCreditBalance(userId);

    const responseData = {
      success: true,
      data: {
        balance,
        userId,
      },
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL.USER_CREDITS, JSON.stringify(responseData));
      logger.info('Credit balance cached successfully', { userId });
    } catch (error) {
      logger.warn('Redis cache write failed for credit balance', { error, userId });
    }

    logger.info('Credit balance retrieved from database', { userId, balance });

    res.json(responseData);
  } catch (error) {
    logger.error('Failed to get credit balance', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit balance',
    });
  }
};

/**
 * Get user's credit transaction history
 */
export const getCreditHistory = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate query parameters
    const validation = creditHistoryQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.issues,
      });
    }

    const { limit, offset, type } = validation.data;

    // Create cache key that includes query parameters
    const cacheKeyParams = JSON.stringify({ limit, offset, type });
    const cacheKey = `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:${cacheKeyParams}`;

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.info('Returning cached credit history', { userId, limit, offset, type });
        const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.json(parsedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed for credit history', { error, userId });
    }

    const result = await getUserCreditHistory(userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      type,
    });

    const responseData = {
      success: true,
      data: result,
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL.USER_CREDIT_HISTORY, JSON.stringify(responseData));
      logger.info('Credit history cached successfully', { userId, limit, offset, type });
    } catch (error) {
      logger.warn('Redis cache write failed for credit history', { error, userId });
    }

    logger.info('Credit history retrieved from database', {
      userId,
      count: result.transactions.length,
      total: result.total,
    });

    res.json(responseData);
  } catch (error) {
    logger.error('Failed to get credit history', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve credit history',
    });
  }
};
