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

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

const prismaClients: PrismaClient[] = [];
let currentIndex = 0;

// Initialize two read-only clients
const urls = [process.env.DATABASE_URL_READ_ONLY_1, process.env.DATABASE_URL_READ_ONLY_2];

for (const url of urls) {
  if (url) {
    // Create the PostgreSQL adapter for each read-only URL
    const adapter = new PrismaPg({
      connectionString: url,
    });

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    prismaClients.push(client);
  }
}

// Function to get the next client in round robin
export function getReadOnlyPrisma(): PrismaClient {
  if (prismaClients.length === 0) {
    throw new Error('No read-only Prisma clients are configured.');
  }

  const client = prismaClients[currentIndex];
  currentIndex = (currentIndex + 1) % prismaClients.length;
  return client;
}

// For backward compatibility, export the first one as prisma
export const prisma =
  prismaClients[0] ??
  (() => {
    throw new Error('No read-only Prisma clients are configured.');
  })();

// Graceful shutdown
process.on('beforeExit', async () => {
  for (const client of prismaClients) {
    await client.$disconnect();
  }
});
