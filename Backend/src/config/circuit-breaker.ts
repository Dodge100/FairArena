import { clerkClient } from '@clerk/express';
import CircuitBreaker from 'opossum';
import logger from '../utils/logger.js';

// Circuit breaker for Clerk API calls
// Prevents cascade failures when Clerk is experiencing issues
export const clerkUserBreaker = new CircuitBreaker(
  async (userId: string) => {
    return await clerkClient.users.getUser(userId);
  },
  {
    timeout: 3000, // 3 second timeout
    errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
    resetTimeout: 30000, // Try again after 30 seconds
    rollingCountTimeout: 10000, // 10 second window
    rollingCountBuckets: 10,
    name: 'clerkUserFetch',
  },
);

// Circuit breaker for batch fetching Clerk users
export const clerkBatchUserBreaker = new CircuitBreaker(
  async (userIds: string[]) => {
    return await clerkClient.users.getUserList({
      userId: userIds,
      limit: userIds.length,
    });
  },
  {
    timeout: 5000, // 5 second timeout for batch operations
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    name: 'clerkBatchUserFetch',
  },
);

// Event listeners for monitoring
clerkUserBreaker.on('open', () => {
  logger.error('Clerk user circuit breaker opened - too many failures');
});

clerkUserBreaker.on('halfOpen', () => {
  logger.warn('Clerk user circuit breaker half-open - testing');
});

clerkUserBreaker.on('close', () => {
  logger.info('Clerk user circuit breaker closed - service recovered');
});

clerkBatchUserBreaker.on('open', () => {
  logger.error('Clerk batch user circuit breaker opened - too many failures');
});

clerkBatchUserBreaker.on('halfOpen', () => {
  logger.warn('Clerk batch user circuit breaker half-open - testing');
});

clerkBatchUserBreaker.on('close', () => {
  logger.info('Clerk batch user circuit breaker closed - service recovered');
});

// Fallback handlers
clerkUserBreaker.fallback(() => {
  logger.warn('Clerk user fetch failed, using fallback');
  return null;
});

clerkBatchUserBreaker.fallback(() => {
  logger.warn('Clerk batch user fetch failed, using fallback');
  return { data: [] };
});
