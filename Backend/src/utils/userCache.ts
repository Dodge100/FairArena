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

import { prisma } from '../config/database.js';
import { redis, REDIS_KEYS } from '../config/redis.js';

export interface CachedUserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  email: string;
}

export async function getCachedUserInfo(userId: string): Promise<CachedUserInfo | null> {
  const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${userId}`;

  try {
    // Try to get from cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      // Upstash Redis might automatically parse JSON strings into objects
      if (
        typeof cachedData === 'object' &&
        cachedData !== null &&
        !(cachedData instanceof Date) &&
        !(cachedData instanceof RegExp)
      ) {
        const obj = cachedData as Record<string, unknown>;
        if (typeof obj.id === 'string' && typeof obj.email === 'string') {
          return obj as unknown as CachedUserInfo;
        }
      }
      try {
        return JSON.parse(cachedData as string);
      } catch (parseError) {
        console.error('Error parsing cached user info:', parseError, { cachedData });
        // If it's the string "[object Object]", it's corrupted, so we delete it
        if (cachedData === '[object Object]') {
          await redis.del(cacheKey);
        }
        return null; // Fallback to DB
      }
    }

    // Fetch from database
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        email: true,
      },
    });

    if (!user) {
      return null;
    }

    // Cache for 5 minutes (300 seconds)
    await redis.set(cacheKey, JSON.stringify(user), { ex: 300 });

    return user;
  } catch (error) {
    console.error('Error fetching cached user info:', error);
    // Fallback to direct DB query if cache fails
    try {
      const user = await prisma.user.findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          email: true,
        },
      });
      return user;
    } catch (dbError) {
      console.error('Error fetching user from database:', dbError);
      return null;
    }
  }
}

export function getUserDisplayName(userInfo: CachedUserInfo): string {
  if (userInfo.firstName && userInfo.lastName) {
    return `${userInfo.firstName} ${userInfo.lastName}`;
  }
  return userInfo.firstName || userInfo.email || 'A user';
}

export async function invalidateUserCache(userId: string): Promise<void> {
  const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${userId}`;
  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.error('Error invalidating user cache:', error);
  }
}
