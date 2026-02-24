/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';

export async function getUserCreditBalance(userId: string): Promise<number> {
  try {
    const lastTransaction = await prisma.creditTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });

    return lastTransaction?.balance || 0;
  } catch (error) {
    logger.error('Failed to get user credit balance', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Get user's credit transaction history with pagination
 */
export async function getUserCreditHistory(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
  } = {},
) {
  try {
    const { limit = 50, offset = 0, type } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          payment: {
            select: {
              razorpayOrderId: true,
              razorpayPaymentId: true,
              planName: true,
              amount: true,
              status: true,
            },
          },
        },
      }),
      prisma.creditTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Failed to get user credit history', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Verify user has sufficient credits for an operation
 */
export async function verifyUserCredits(
  userId: string,
  requiredCredits: number,
): Promise<{ sufficient: boolean; currentBalance: number; required: number }> {
  try {
    const currentBalance = await getUserCreditBalance(userId);

    return {
      sufficient: currentBalance >= requiredCredits,
      currentBalance,
      required: requiredCredits,
    };
  } catch (error) {
    logger.error('Failed to verify user credits', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      requiredCredits,
    });
    throw error;
  }
}

/**
 * Add credits to user account
 */
export async function addUserCredits(
  userId: string,
  amount: number,
  type:
    | 'BONUS'
    | 'PURCHASE'
    | 'REFUND'
    | 'ADJUSTMENT'
    | 'TRANSFER_IN'
    | 'INITIAL_ALLOCATION'
    | 'COUPON_REDEMPTION',
  description: string,
  metadata?: Record<string, unknown>,
  tx?: any, // We keep any here because Prisma's transaction client type is complex to import from generated
): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
  try {
    const execute = async (client: any) => {
      // Get current balance
      const lastTransaction = await client.creditTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTransaction?.balance || 0;
      const newBalance = currentBalance + amount;

      // Create addition transaction
      const transaction = await client.creditTransaction.create({
        data: {
          userId,
          amount,
          balance: newBalance,
          type,
          description,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });

      logger.info('Credits added successfully', {
        userId,
        amount,
        newBalance,
        transactionId: transaction.id,
      });

      // Invalidate user credits cache using robust pattern
      try {
        const patterns = [
          `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}:*`,
          `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:*`,
          `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`,
        ];

        for (const pattern of patterns) {
          if (pattern.includes('*')) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
              await redis.del(...keys);
            }
          } else {
            await redis.del(pattern);
          }
        }

        logger.info('User credits cache invalidated after addition', { userId });
      } catch (error) {
        logger.warn('Failed to invalidate credits cache after addition', { error, userId });
      }

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
      };
    };

    if (tx) {
      return await execute(tx);
    }

    return await prisma.$transaction(async (newTx) => {
      return await execute(newTx);
    });
  } catch (error) {
    logger.error('Failed to add user credits', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      amount,
    });
    throw error;
  }
}

export async function deductUserCredits(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>,
  tx?: any,
): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
  try {
    const execute = async (client: any) => {
      // Get current balance
      const lastTransaction = await client.creditTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTransaction?.balance || 0;

      if (currentBalance < amount) {
        throw new Error('Insufficient credits');
      }

      const newBalance = currentBalance - amount;

      // Create deduction transaction
      const transaction = await client.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          balance: newBalance,
          type: 'DEDUCTION',
          description,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });

      logger.info('Credits deducted successfully', {
        userId,
        amount,
        newBalance,
        transactionId: transaction.id,
      });

      // Invalidate user credits cache using robust pattern
      try {
        const patterns = [
          `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}:*`,
          `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:*`,
          `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`,
        ];

        for (const pattern of patterns) {
          if (pattern.includes('*')) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
              await redis.del(...keys);
            }
          } else {
            await redis.del(pattern);
          }
        }

        logger.info('User credits cache invalidated after deduction', { userId });
      } catch (error) {
        logger.warn('Failed to invalidate credits cache after deduction', { error, userId });
      }

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
      };
    };

    if (tx) {
      return await execute(tx);
    }

    return await prisma.$transaction(async (newTx) => {
      return await execute(newTx);
    });
  } catch (error) {
    logger.error('Failed to deduct user credits', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      amount,
    });
    throw error;
  }
}
