import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getCachedUserInfo } from '../../utils/userCache.js';

// Validation schemas
const userIdSchema = z.string().min(1).max(255);

const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).nullish(),
  bio: z.string().trim().max(500).nullish(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullish(),
  dateOfBirth: z.string().nullish(),
  phoneNumber: z.string().trim().max(20).nullish(),
  location: z.string().trim().max(200).nullish(),
  jobTitle: z.string().trim().max(200).nullish(),
  company: z.string().trim().max(200).nullish(),
  yearsOfExperience: z.number().int().min(0).max(100).nullish(),
  experiences: z.array(z.string().max(500)).max(20).nullish(),
  education: z.array(z.string().max(500)).max(20).nullish(),
  skills: z.array(z.string().max(100)).max(100).nullish(),
  languages: z.array(z.string().max(50)).max(50).nullish(),
  interests: z.array(z.string().max(100)).max(50).nullish(),
  certifications: z.array(z.string().max(200)).max(20).nullish(),
  awards: z.array(z.string().trim().max(200)).max(20).nullish(),
  githubUsername: z.string().trim().max(100).nullish(),
  twitterHandle: z.string().trim().max(100).nullish(),
  linkedInProfile: z.union([z.string().url().max(500), z.literal('')]).nullish(),
  portfolioUrl: z.union([z.string().url().max(500), z.literal('')]).nullish(),
  resumeUrl: z.union([z.string().url().max(500), z.literal('')]).nullish(),
  isPublic: z.boolean().nullish(),
  requireAuth: z.boolean().nullish(),
  trackViews: z.boolean().nullish(),
});

// Get public profile by userId
export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate userId
    const validation = userIdSchema.safeParse(userId);
    if (!validation.success) {
      return res.status(400).json({
        error: { message: 'Invalid user ID', status: 400 },
      });
    }

    const auth = req.user;
    const viewerUserId = auth?.userId;

    const readOnlyPrisma = getReadOnlyPrisma();

    // Check cache first
    const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${userId}`;
    try {
      const cachedProfile = await redis.get(cacheKey);
      if (cachedProfile) {
        let profileData;
        if (typeof cachedProfile === 'string') {
          profileData = JSON.parse(cachedProfile);
        } else {
          // If Redis returns an object (auto-parsed), use it directly
          profileData = cachedProfile;
        }

        // Check if profile is public
        if (!profileData.isPublic) {
          return res.status(404).json({
            error: { message: 'Profile not found or not public', status: 404 },
          });
        }

        // Check if authentication is required
        if (profileData.requireAuth && !viewerUserId) {
          return res.status(401).json({
            error: {
              message: 'Authentication required to view this profile',
              status: 401,
              code: 'AUTH_REQUIRED',
            },
          });
        }

        // Compute viewer-specific meta
        const shouldTrackViews =
          profileData.requireAuth &&
          profileData.trackViews &&
          viewerUserId &&
          viewerUserId !== profileData.userId;
        let hasConsent = false;

        if (shouldTrackViews) {
          try {
            const existingView = await readOnlyPrisma.profileView.findUnique({
              where: {
                profileId_viewerUserId: {
                  profileId: profileData.id,
                  viewerUserId: viewerUserId!,
                },
              },
            });
            hasConsent = !!existingView;
          } catch (viewError) {
            logger.warn('Error checking view consent:', { error: viewError });
          }
        }

        // Get viewer star status with caching
        let hasStarred = false;
        let starredAt = null;

        if (viewerUserId && viewerUserId !== profileData.userId) {
          // Cache key for user star status
          const starCacheKey = `${REDIS_KEYS.PROFILE_STAR}${profileData.id}:${viewerUserId}`;
          try {
            const cachedStar = await redis.get(starCacheKey);
            if (cachedStar !== null) {
              const starData = typeof cachedStar === 'string' ? JSON.parse(cachedStar) : cachedStar;
              hasStarred = starData.hasStarred || false;
              starredAt = starData.starredAt || null;
            } else {
              const userStar = await readOnlyPrisma.profileStars.findFirst({
                where: {
                  profileId: profileData.id,
                  userId: viewerUserId,
                },
                select: { createdAt: true },
              });
              hasStarred = !!userStar;
              starredAt = userStar?.createdAt || null;
              // Cache the star status for 1 hour
              await redis.setex(starCacheKey, 3600, JSON.stringify({ hasStarred, starredAt }));
            }
          } catch (starError) {
            logger.warn('Error fetching star data from cache:', { error: starError });
          }
        }

        logger.info('Serving public profile from cache for user:', { userId });
        const responseData = {
          data: {
            ...profileData,
            stars: {
              count: profileData.starCount || 0,
              hasStarred,
              starredAt,
            },
          },
          meta: {
            requiresConsent: shouldTrackViews && !hasConsent,
            isOwner: viewerUserId === profileData.userId,
          },
        };

        return res.status(200).json(responseData);
      }
    } catch (cacheError) {
      logger.warn('Cache read error:', { error: cacheError });
      // Continue without cache
    }

    const profile = await readOnlyPrisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    // Fetch user data from cache/DB
    let avatarUrl = null;
    let email = null;
    try {
      const userInfo = await getCachedUserInfo(profile.userId);
      if (userInfo) {
        avatarUrl = userInfo.profileImageUrl;
        email = userInfo.email;
      }
    } catch (error) {
      logger.error('Error fetching user info:', { error });
    }

    // Get star count (cache this as it's expensive)
    let starCount = 0;
    try {
      starCount = await readOnlyPrisma.profileStars.count({
        where: { profileId: profile.id },
      });
    } catch (starError) {
      logger.warn('Error fetching star count:', { error: starError });
    }

    const profileWithExtras = {
      ...profile,
      avatarUrl,
      email,
      starCount,
    };

    // Cache the complete profile data for 1 hour (3600 seconds) - including private profiles
    try {
      await redis.setex(cacheKey, 3600, JSON.stringify(profileWithExtras));
      logger.info('Profile cached successfully for user:', { userId });
    } catch (cacheError) {
      logger.warn('Cache write error:', { error: cacheError });
    }

    // Now apply access control checks AFTER caching
    // Check if profile is public
    if (!profile.isPublic) {
      return res.status(404).json({
        error: { message: 'Profile not found or not public', status: 404 },
      });
    }

    // Check if authentication is required
    if (profile.requireAuth && !viewerUserId) {
      return res.status(401).json({
        error: {
          message: 'Authentication required to view this profile',
          status: 401,
          code: 'AUTH_REQUIRED',
        },
      });
    }

    // Check if view tracking is enabled (only when requireAuth is true)
    const shouldTrackViews =
      profile.requireAuth && profile.trackViews && viewerUserId && viewerUserId !== profile.userId;

    // Check if viewer has already given consent
    let hasConsent = false;
    if (shouldTrackViews) {
      try {
        const existingView = await readOnlyPrisma.profileView.findUnique({
          where: {
            profileId_viewerUserId: {
              profileId: profile.id,
              viewerUserId: viewerUserId!,
            },
          },
        });
        hasConsent = !!existingView;
      } catch (viewError) {
        logger.warn('Error checking view consent:', { error: viewError });
      }
    }

    // Get viewer-specific star status with caching
    let hasStarred = false;
    let starredAt = null;

    if (viewerUserId && viewerUserId !== profile.userId) {
      const starCacheKey = `${REDIS_KEYS.PROFILE_STAR}${profile.id}:${viewerUserId}`;
      try {
        const cachedStar = await redis.get(starCacheKey);
        if (cachedStar !== null) {
          const starData = typeof cachedStar === 'string' ? JSON.parse(cachedStar) : cachedStar;
          hasStarred = starData.hasStarred || false;
          starredAt = starData.starredAt || null;
        } else {
          const userStar = await readOnlyPrisma.profileStars.findFirst({
            where: {
              profileId: profile.id,
              userId: viewerUserId,
            },
            select: { createdAt: true },
          });
          hasStarred = !!userStar;
          starredAt = userStar?.createdAt || null;
          // Cache the star status for 1 hour
          await redis.setex(starCacheKey, 3600, JSON.stringify({ hasStarred, starredAt }));
        }
      } catch (starError) {
        logger.warn('Error fetching viewer star data:', { error: starError });
      }
    }

    const responseData = {
      data: {
        ...profileWithExtras,
        stars: {
          count: profileWithExtras.starCount,
          hasStarred,
          starredAt,
        },
      },
      meta: {
        requiresConsent: shouldTrackViews && !hasConsent,
        isOwner: viewerUserId === profile.userId,
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error fetching public profile:', { error });
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Get own profile (authenticated)
export const getOwnProfile = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized - Authentication required', status: 401 },
      });
    }
    const userInfo = await getCachedUserInfo(userId);

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized - Authentication required', status: 401 },
      });
    }

    // Validate userId from auth
    const validation = userIdSchema.safeParse(userId);
    if (!validation.success) {
      return res.status(400).json({
        error: { message: 'Invalid user ID in authentication', status: 400 },
      });
    }

    // Check cache first
    const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${userId}`;
    try {
      const cachedProfile = await redis.get(cacheKey);
      if (cachedProfile) {
        logger.info('Serving own profile from cache for user:', { userId });
        const profileData =
          typeof cachedProfile === 'string' ? JSON.parse(cachedProfile) : cachedProfile;
        return res.status(200).json({ data: profileData });
      }
    } catch (cacheError) {
      logger.warn('Cache read error:', { error: cacheError });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    let profile = await readOnlyPrisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Ensure user exists in database
      const email = userInfo?.email || '';

      try {
        await prisma.user.upsert({
          where: { userId },
          update: { email },
          create: { userId, email },
        });
      } catch (error: unknown) {
        const prismaError = error as { code?: string; meta?: { target?: string[] } };
        if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('email')) {
          // Email conflict, update the existing user with this userId
          await prisma.user.update({
            where: { email },
            data: { userId },
          });
        } else {
          throw error;
        }
      }

      // Create default profile if not exists
      profile = await prisma.profile.create({
        data: {
          userId,
          bio: '',
          isPublic: true,
          requireAuth: false,
          trackViews: true,
        },
      });
    }

    // Cache the profile data for 1 hour (3600 seconds)
    try {
      await redis.setex(cacheKey, 3600, JSON.stringify(profile));
      logger.info('Own profile cached successfully for user:', { userId });
    } catch (cacheError) {
      logger.warn('Cache write error:', { cacheError });
    }

    return res.status(200).json({ data: profile });
  } catch (error) {
    logger.error('Error fetching own profile:', { error });
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Update profile (authenticated)
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized', status: 401 },
      });
    }

    // Validate request body
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid request data',
          status: 400,
          details: validation.error.issues,
        },
      });
    }

    const profileData = validation.data;

    // Send event to Inngest for async processing
    await inngest.send({
      name: 'profile/update',
      data: {
        userId,
        profileData,
      },
    });

    // Return immediate response
    return res.status(202).json({
      message: 'Profile update queued successfully',
      status: 'processing',
    });
  } catch (error) {
    logger.error('Error queuing profile update:', { error });
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};
