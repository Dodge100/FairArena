import { PrismaClient } from '@prisma/client';
import { ENV } from './env.js';

const prismaClients: PrismaClient[] = [];
let currentIndex = 0;

// Initialize two read-only clients
const urls = [ENV.DATABASE_URL_READ_ONLY_1, ENV.DATABASE_URL_READ_ONLY_2];

for (const url of urls) {
  const client = new PrismaClient({
    log: ENV.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url,
      },
    },
  });
  prismaClients.push(client);
}

// Function to get the next client in round robin
export function getReadOnlyPrisma(): PrismaClient {
  const client = prismaClients[currentIndex];
  currentIndex = (currentIndex + 1) % prismaClients.length;
  return client;
}

// For backward compatibility, export the first one as prisma
export const prisma = prismaClients[0];

// Graceful shutdown
process.on('beforeExit', async () => {
  for (const client of prismaClients) {
    await client.$disconnect();
  }
});
