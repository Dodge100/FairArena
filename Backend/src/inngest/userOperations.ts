import { prisma } from '../config/database.js';

export async function upsertUser(userId: string, email: string) {
  if (!userId || !email) {
    throw new Error('userId and email are required');
  }

  await prisma.user.upsert({
    where: { userId },
    update: { email },
    create: { userId, email },
  });
}
