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

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

// Constants
const API_KEY_PREFIX = 'fa_'; // FairArena prefix
const API_KEY_LENGTH = 32; // 256 bits of randomness
const API_KEY_CACHE_TTL = 300; // 5 minutes cache
const API_KEY_CACHE_PREFIX = 'apikey:';

// Types
export interface ApiKeyData {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKeyData;
  error?: string;
}

export interface GeneratedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey: string; // Only returned once during creation
  expiresAt: Date | null;
  createdAt: Date;
}

export function generateApiKey(environment: 'live' | 'test' = 'live'): string {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const randomPart = randomBytes.toString('base64url').substring(0, 32);
  return `${API_KEY_PREFIX}${environment}_${randomPart}`;
}

/**
 * Extract prefix from API key (first 12 chars including env marker)
 */
export function extractKeyPrefix(apiKey: string): string {
  // Format: fa_live_xxxx... -> fa_live_xx (first 10 chars of random)
  const parts = apiKey.split('_');
  if (parts.length >= 3) {
    return `${parts[0]}_${parts[1]}_${parts[2].substring(0, 4)}`;
  }
  return apiKey.substring(0, 12);
}

/**
 * Hash an API key using SHA-256
 * We never store the raw key, only the hash
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  options: {
    expiresIn?: number; // Days until expiration
    environment?: 'live' | 'test';
  } = {},
): Promise<GeneratedApiKey> {
  const { expiresIn, environment = 'live' } = options;

  // Generate the key
  const fullKey = generateApiKey(environment);
  const keyPrefix = extractKeyPrefix(fullKey);
  const keyHash = hashApiKey(fullKey);

  // Calculate expiration
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

  // Store in database
  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix,
      keyHash,
      expiresAt,
    },
  });

  logger.info('API key created', {
    userId,
    keyId: apiKey.id,
    keyPrefix,
    expiresAt,
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    fullKey, // Only returned once!
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  };
}

/**
 * Validate an API key and return the associated data
 * Uses Redis caching for performance
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  // Basic format validation
  if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyHash = hashApiKey(apiKey);
  const cacheKey = `${API_KEY_CACHE_PREFIX}${keyHash}`;

  // Try cache first
  try {
    const cachedData = await redis.get<string>(cacheKey);
    if (cachedData) {
      const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;

      // Check if cached as invalid
      if (parsed.invalid) {
        return { valid: false, error: 'Invalid API key' };
      }

      // Check expiration
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        await redis.del(cacheKey);
        return { valid: false, error: 'API key has expired' };
      }

      // Check if revoked
      if (parsed.revokedAt) {
        return { valid: false, error: 'API key has been revoked' };
      }

      return { valid: true, apiKey: parsed };
    }
  } catch (cacheError) {
    logger.warn('API key cache read error', { error: (cacheError as Error).message });
  }

  // Query database
  const dbApiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      name: true,
      keyPrefix: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
      user: {
        select: {
          isBanned: true,
        },
      },
    },
  });

  // Key not found - cache negative result briefly
  if (!dbApiKey) {
    try {
      await redis.setex(cacheKey, 60, JSON.stringify({ invalid: true }));
    } catch {
      // Ignore cache write error
    }
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if user is banned
  if (dbApiKey.user.isBanned) {
    return { valid: false, error: 'User account is suspended' };
  }

  // Check if revoked
  if (dbApiKey.revokedAt) {
    return { valid: false, error: 'API key has been revoked' };
  }

  // Check if expired
  if (dbApiKey.expiresAt && dbApiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Build response data
  const apiKeyData: ApiKeyData = {
    id: dbApiKey.id,
    userId: dbApiKey.userId,
    name: dbApiKey.name,
    keyPrefix: dbApiKey.keyPrefix,
    expiresAt: dbApiKey.expiresAt,
    lastUsedAt: dbApiKey.lastUsedAt,
    createdAt: dbApiKey.createdAt,
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, API_KEY_CACHE_TTL, JSON.stringify(apiKeyData));
  } catch (cacheError) {
    logger.warn('API key cache write error', { error: (cacheError as Error).message });
  }

  return { valid: true, apiKey: apiKeyData };
}

const LAST_USED_THROTTLE_SECONDS = 300; // 5 minutes

/**
 * Update last used timestamp for an API key
 * Done asynchronously to not block the request
 * Throttled to reduce DB writes (max once per 5 minutes per key)
 */
export async function updateApiKeyLastUsed(apiKeyId: string, ipAddress: string): Promise<void> {
  const throttleKey = `apikey_lastused:${apiKeyId}`;

  try {
    // Check if we updated recently
    const recentUpdate = await redis.get(throttleKey);
    if (recentUpdate) {
      return; // Skip DB update
    }

    // Update DB
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ipAddress,
      },
    });

    // Set throttle flag in Redis
    await redis.setex(throttleKey, LAST_USED_THROTTLE_SECONDS, '1');
  } catch (error) {
    logger.warn('Failed to update API key last used', {
      apiKeyId,
      error: (error as Error).message,
    });
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId: string, apiKeyId: string): Promise<boolean> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      return false;
    }

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    // Invalidate cache
    const cacheKey = `${API_KEY_CACHE_PREFIX}${apiKey.keyHash}`;
    await redis.del(cacheKey);

    logger.info('API key revoked', { userId, apiKeyId });
    return true;
  } catch (error) {
    logger.error('Failed to revoke API key', { userId, apiKeyId, error: (error as Error).message });
    throw error;
  }
}

/**
 * List all API keys for a user (without sensitive data)
 */
export async function listUserApiKeys(userId: string): Promise<ApiKeyData[]> {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      keyPrefix: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return apiKeys;
}

/**
 * Get count of active API keys for a user
 */
export async function countUserApiKeys(userId: string): Promise<number> {
  return prisma.apiKey.count({
    where: {
      userId,
    },
  });
}

/**
 * Update API key name
 */
export async function updateApiKeyName(
  userId: string,
  apiKeyId: string,
  name: string,
): Promise<boolean> {
  try {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: apiKeyId,
        userId,
        revokedAt: null,
      },
      data: { name },
    });

    return result.count > 0;
  } catch (error) {
    logger.error('Failed to update API key name', {
      userId,
      apiKeyId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Invalidate cache for a specific API key hash
 */
export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  const cacheKey = `${API_KEY_CACHE_PREFIX}${keyHash}`;
  await redis.del(cacheKey);
}
