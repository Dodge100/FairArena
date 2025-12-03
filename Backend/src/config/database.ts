import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';
import { ENV } from './env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create the PostgreSQL adapter
const adapter = new PrismaPg({
  connectionString: ENV.DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ENV.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (ENV.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
