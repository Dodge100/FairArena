import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';

export async function upsertUser(userId: string, email: string) {
  if (!userId || !email) {
    throw new Error('userId and email are required');
  }
  try {
    await prisma.user.upsert({
      where: { userId },
      update: { email },
      create: { userId, email },
    });
    logger.info('User upserted', { userId, email });
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target;
      if (target?.includes('email')) {
        await prisma.user.update({
          where: { email },
          data: { userId },
        });
        logger.info('User updated via email conflict', { userId, email });
        return;
      }
    }
    logger.error('Error upserting user', {
      userId,
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deleteUser(userId: string) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Prisma will handle cascading deletes automatically due to onDelete: Cascade in schema
    await prisma.user.delete({
      where: { userId },
    });
    logger.info('User deleted successfully with cascading deletes', { userId });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      // User not found, which is fine for deletion
      logger.warn(`User ${userId} not found in database, possibly already deleted`);
    } else {
      logger.error('Error deleting user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
