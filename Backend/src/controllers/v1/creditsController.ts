import { Request, Response } from 'express';
import { z } from 'zod';
import { getUserCreditBalance, getUserCreditHistory } from '../../services/v1/creditService.js';
import logger from '../../utils/logger.js';

const creditHistoryQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  type: z.string().optional(),
});

/**
 * Get user's current credit balance
 */
export const getCreditBalance = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const balance = await getUserCreditBalance(userId);

    logger.info('Credit balance retrieved', { userId, balance });

    res.json({
      success: true,
      data: {
        balance,
        userId,
      },
    });
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

    const result = await getUserCreditHistory(userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      type,
    });

    logger.info('Credit history retrieved', {
      userId,
      count: result.transactions.length,
      total: result.total,
    });

    res.json({
      success: true,
      data: result,
    });
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
