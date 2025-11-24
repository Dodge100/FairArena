import type { Request, Response } from 'express';
import { z } from 'zod';
import { clerkBatchUserBreaker } from '../../config/circuit-breaker.js';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

// Validation schemas
const starProfileSchema = z.object({
  profileId: z.string().min(1).max(255),
});

const unstarProfileSchema = z.object({
  profileId: z.string().min(1).max(255),
});

// Star a profile
export const starProfile = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body;
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized', status: 401 },
      });
    }

    // Rate limiting: max 10 star operations per minute
    const rateLimitKey = `${REDIS_KEYS.STAR_RATE_LIMIT}${userId}:star`;
    try {
      const attempts = await redis.incr(rateLimitKey);
      if (attempts === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      if (attempts > 10) {
        return res.status(429).json({
          error: {
            message: 'Too many star requests. Please try again later.',
            status: 429,
            retryAfter: 60,
          },
        });
      }
    } catch (rateLimitError) {
      logger.warn('Rate limit check failed:', rateLimitError);
      // Continue without rate limiting rather than failing the request
    }

    // Validate input
    const validation = starProfileSchema.safeParse({ profileId });
    if (!validation.success) {
      return res.status(400).json({
        error: { message: 'Invalid profile ID', status: 400 },
      });
    }

    // Quick validation - check if profile exists and is public
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, isPublic: true },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    if (!profile.isPublic) {
      return res.status(403).json({
        error: { message: 'Profile is not public', status: 403 },
      });
    }

    // Check if user is trying to star their own profile
    if (profile.userId === userId) {
      return res.status(400).json({
        error: { message: 'Cannot star your own profile', status: 400 },
      });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'profile.star',
      data: {
        profileId,
        userId,
      },
    });

    logger.info(`Star queued: profile ${profileId} by user ${userId}`);

    res.status(202).json({
      success: true,
      message: 'Star request queued and will be processed shortly',
    });
  } catch (error) {
    logger.error('Error queuing star request:', error);
    res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Unstar a profile
export const unstarProfile = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body;
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized', status: 401 },
      });
    }

    // Rate limiting: max 10 unstar operations per minute
    const rateLimitKey = `${REDIS_KEYS.STAR_RATE_LIMIT}${userId}:unstar`;
    try {
      const attempts = await redis.incr(rateLimitKey);
      if (attempts === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      if (attempts > 10) {
        return res.status(429).json({
          error: {
            message: 'Too many unstar requests. Please try again later.',
            status: 429,
            retryAfter: 60,
          },
        });
      }
    } catch (rateLimitError) {
      logger.warn('Rate limit check failed:', rateLimitError);
      // Continue without rate limiting rather than failing the request
    }

    // Validate input
    const validation = unstarProfileSchema.safeParse({ profileId });
    if (!validation.success) {
      return res.status(400).json({
        error: { message: 'Invalid profile ID', status: 400 },
      });
    }

    // Send to Inngest for async processing
    await inngest.send({
      name: 'profile.unstar',
      data: {
        profileId,
        userId,
      },
    });

    logger.info(`Unstar queued: profile ${profileId} by user ${userId}`);

    res.status(202).json({
      success: true,
      message: 'Unstar request queued and will be processed shortly',
    });
  } catch (error) {
    logger.error('Error queuing unstar request:', error);
    res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Get stars for a profile
export const getProfileStars = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { cursor, limit = 20 } = req.query;

    // Safely parse and validate limit
    const rawLimit = Number(limit);
    const safeLimit = Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 20;

    // Find the profile by userId
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, isPublic: true },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    // Check if profile is public
    if (!profile.isPublic) {
      return res.status(403).json({
        error: { message: 'Profile is not public', status: 403 },
      });
    }

    // Use cursor pagination for better performance
    const stars = await prisma.profileStars.findMany({
      where: { profileId: profile.id },
      include: {
        user: {
          select: {
            userId: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      cursor: cursor ? { id: cursor as string } : undefined,
      take: safeLimit + 1, // +1 to check if more results exist
      skip: cursor ? 1 : 0, // Skip the cursor
    });

    // Check if there are more results
    const hasMore = stars.length > safeLimit;
    if (hasMore) {
      stars.pop(); // Remove the extra item
    }

    // Get total count from cache or database
    const cacheKey = `${REDIS_KEYS.STAR_COUNT_CACHE}${profile.id}`;
    let totalCount: number;

    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        totalCount = parseInt(cached as string, 10);
      } else {
        totalCount = await prisma.profileStars.count({
          where: { profileId: profile.id },
        });
        // Cache for 5 minutes
        await redis.setex(cacheKey, 300, totalCount.toString());
      }
    } catch (cacheError) {
      logger.warn('Cache error, falling back to database:', cacheError);
      totalCount = await prisma.profileStars.count({
        where: { profileId: profile.id },
      });
    }

    // Batch fetch all user data from Clerk to avoid N+1 queries
    const userIds = stars.map((star) => star.userId);
    let clerkUsersMap = new Map<
      string,
      { imageUrl: string | null; firstName: string | null; lastName: string | null }
    >();

    if (userIds.length > 0) {
      try {
        // Batch fetch users from Clerk with circuit breaker protection
        const clerkUsersResponse = await clerkBatchUserBreaker.fire(userIds);

        // Create a map for O(1) lookup
        if (clerkUsersResponse && clerkUsersResponse.data) {
          clerkUsersMap = new Map(
            clerkUsersResponse.data.map(
              (u: {
                id: string;
                imageUrl: string;
                firstName: string | null;
                lastName: string | null;
              }) => [u.id, { imageUrl: u.imageUrl, firstName: u.firstName, lastName: u.lastName }],
            ),
          );
        }
      } catch (clerkError) {
        logger.warn('Failed to batch fetch Clerk users (circuit may be open):', clerkError);
        // Continue with null avatars instead of failing the request
      }
    }

    // Format stars with cached/fetched data
    const formattedStars = stars.map((star) => {
      const clerkUser = clerkUsersMap.get(star.userId);

      // Prioritize profile data, fallback to Clerk data, then Anonymous
      const firstName = star.user.profile?.firstName || clerkUser?.firstName;
      const lastName = star.user.profile?.lastName || clerkUser?.lastName;
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Anonymous';

      return {
        id: star.id,
        userId: star.userId,
        createdAt: star.createdAt,
        starrer: {
          userId: star.user.userId,
          name,
          avatarUrl: clerkUser?.imageUrl || null,
        },
      };
    });

    res.json({
      success: true,
      data: {
        stars: formattedStars,
        pagination: {
          cursor: hasMore ? stars[stars.length - 1].id : null,
          hasMore,
          limit: safeLimit,
          total: totalCount,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting profile stars:', error);
    res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Check if user has starred a profile
export const checkStarStatus = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized', status: 401 },
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    const star = await prisma.profileStars.findFirst({
      where: {
        profileId,
        userId,
      },
      select: { id: true, createdAt: true },
    });

    const starCount = await prisma.profileStars.count({
      where: { profileId },
    });

    res.json({
      success: true,
      data: {
        hasStarred: !!star,
        starCount,
        starredAt: star?.createdAt || null,
      },
    });
  } catch (error) {
    logger.error('Error checking star status:', error);
    res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};
