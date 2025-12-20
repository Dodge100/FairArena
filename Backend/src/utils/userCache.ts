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
      return JSON.parse(cachedData as string);
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
