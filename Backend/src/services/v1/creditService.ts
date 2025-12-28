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
    const where = { userId } as any;
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
  type: 'BONUS' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'INITIAL_ALLOCATION',
  description: string,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get current balance
      const lastTransaction = await tx.creditTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTransaction?.balance || 0;
      const newBalance = currentBalance + amount;

      // Create addition transaction
      const transaction = await tx.creditTransaction.create({
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

      // Invalidate user credits cache
      try {
        const creditsCacheKey = `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`;
        const historyCachePattern = `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:*`;

        // Delete specific cache keys
        await redis.del(creditsCacheKey);

        // Delete all credit history cache keys for this user
        const historyKeys = await redis.keys(historyCachePattern);
        if (historyKeys.length > 0) {
          await redis.del(...historyKeys);
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
): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get current balance
      const lastTransaction = await tx.creditTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const currentBalance = lastTransaction?.balance || 0;

      if (currentBalance < amount) {
        throw new Error('Insufficient credits');
      }

      const newBalance = currentBalance - amount;

      // Create deduction transaction
      const transaction = await tx.creditTransaction.create({
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

      // Invalidate user credits cache
      try {
        const creditsCacheKey = `${REDIS_KEYS.USER_CREDITS_CACHE}${userId}`;
        const historyCachePattern = `${REDIS_KEYS.USER_CREDIT_HISTORY_CACHE}${userId}:*`;

        // Delete specific cache keys
        await redis.del(creditsCacheKey);

        // Delete all credit history cache keys for this user
        const historyKeys = await redis.keys(historyCachePattern);
        if (historyKeys.length > 0) {
          await redis.del(...historyKeys);
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
