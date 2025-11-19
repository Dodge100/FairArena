import { prisma } from '../../config/database.js';

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
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target;
      if (target?.includes('email')) {
        return await prisma.user.update({
          where: { email },
          data: { userId },
        });
      }
    }
    throw error;
  }
}

export async function deleteUser(userId: string) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    await prisma.user.delete({
      where: { userId },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      // User not found, which is fine for deletion
      console.log(`User ${userId} not found in database, possibly already deleted`);
    } else {
      throw error;
    }
  }
}
