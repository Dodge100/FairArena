import { clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

// Validation schemas
const userIdSchema = z.string().min(1).max(255);

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).nullish(),
  lastName: z.string().min(1).max(100).nullish(),
  bio: z.string().max(500).nullish(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullish(),
  dateOfBirth: z.string().nullish(),
  phoneNumber: z.string().max(20).nullish(),
  location: z.string().max(200).nullish(),
  jobTitle: z.string().max(200).nullish(),
  company: z.string().max(200).nullish(),
  yearsOfExperience: z.number().int().min(0).max(100).nullish(),
  experiences: z.array(z.string().max(500)).max(20).nullish(),
  education: z.array(z.string().max(500)).max(20).nullish(),
  skills: z.array(z.string().max(100)).max(100).nullish(),
  languages: z.array(z.string().max(50)).max(50).nullish(),
  interests: z.array(z.string().max(100)).max(50).nullish(),
  certifications: z.array(z.string().max(200)).max(20).nullish(),
  awards: z.array(z.string().max(200)).max(20).nullish(),
  githubUsername: z.string().max(100).nullish(),
  twitterHandle: z.string().max(100).nullish(),
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

    const auth = req.auth();
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

        // Compute viewer-specific meta
        const shouldTrackViews =
          profileData.requireAuth &&
          profileData.trackViews &&
          viewerUserId &&
          viewerUserId !== profileData.userId;
        let hasConsent = false;
        if (shouldTrackViews) {
          const existingView = await readOnlyPrisma.profileView.findUnique({
            where: {
              profileId_viewerUserId: {
                profileId: profileData.id,
                viewerUserId: viewerUserId!,
              },
            },
          });
          hasConsent = !!existingView;
        }

        // Get fresh star data for viewer
        let starCount = 0;
        let hasStarred = false;
        let starredAt = null;

        try {
          starCount = await prisma.profileStars.count({
            where: { profileId: profileData.id },
          });

          if (viewerUserId && viewerUserId !== profileData.userId) {
            const userStar = await prisma.profileStars.findFirst({
              where: {
                profileId: profileData.id,
                userId: viewerUserId,
              },
              select: { createdAt: true },
            });
            hasStarred = !!userStar;
            starredAt = userStar?.createdAt || null;
          }
        } catch (starError) {
          logger.warn('Error fetching star data from cache:', starError);
        }

        const responseData = {
          data: {
            ...profileData,
            stars: {
              count: starCount,
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
      logger.warn('Cache read error:', cacheError);
      // Continue without cache
    }

    const profile = await readOnlyPrisma.profile.findFirst({
      where: {
        userId,
        isPublic: true,
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        bio: true,
        gender: true,
        dateOfBirth: true,
        location: true,
        jobTitle: true,
        company: true,
        yearsOfExperience: true,
        experiences: true,
        education: true,
        skills: true,
        languages: true,
        interests: true,
        certifications: true,
        awards: true,
        githubUsername: true,
        twitterHandle: true,
        linkedInProfile: true,
        resumeUrl: true,
        portfolioUrl: true,
        requireAuth: true,
        trackViews: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
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
      const existingView = await readOnlyPrisma.profileView.findUnique({
        where: {
          profileId_viewerUserId: {
            profileId: profile.id,
            viewerUserId: viewerUserId!,
          },
        },
      });
      hasConsent = !!existingView;
    }

    // Remove privacy settings from response
    const { ...profileData } = profile;

    // Fetch Clerk user data for avatar and email
    let avatarUrl = null;
    let email = null;
    try {
      const clerkUser = await clerkClient.users.getUser(profile.userId);
      avatarUrl = clerkUser.imageUrl || null;
      email = clerkUser.primaryEmailAddress?.emailAddress || null;
    } catch (error) {
      logger.error('Error fetching Clerk user:', error);
    }

    const profileWithExtras = {
      ...profileData,
      avatarUrl,
      email,
    };

    // Get star count and user's star status
    let starCount = 0;
    let hasStarred = false;
    let starredAt = null;

    try {
      // Get star count
      starCount = await prisma.profileStars.count({
        where: { profileId: profile.id },
      });

      // Check if viewer has starred (only if authenticated)
      if (viewerUserId && viewerUserId !== profile.userId) {
        const userStar = await prisma.profileStars.findFirst({
          where: {
            profileId: profile.id,
            userId: viewerUserId,
          },
          select: { createdAt: true },
        });
        hasStarred = !!userStar;
        starredAt = userStar?.createdAt || null;
      }
    } catch (starError) {
      logger.warn('Error fetching star data:', starError);
      // Continue without star data
    }

    const responseData = {
      data: {
        ...profileWithExtras,
        stars: {
          count: starCount,
          hasStarred,
          starredAt,
        },
      },
      meta: {
        requiresConsent: shouldTrackViews && !hasConsent,
        isOwner: viewerUserId === profile.userId,
      },
    };

    // Cache the profile data for 1 hour (3600 seconds)
    try {
      await redis.setex(cacheKey, 3600, JSON.stringify(profileWithExtras));
      logger.info('Profile cached successfully for user:', userId);
    } catch (cacheError) {
      logger.warn('Cache write error:', cacheError);
    }

    return res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error fetching public profile:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Get own profile (authenticated)
export const getOwnProfile = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

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

    const readOnlyPrisma = getReadOnlyPrisma();
    let profile = await readOnlyPrisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Ensure user exists in database
      let email = '';
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        email = clerkUser.primaryEmailAddress?.emailAddress || '';
      } catch (error) {
        logger.error('Error fetching Clerk user for profile creation:', error);
      }

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

    return res.status(200).json({ data: profile });
  } catch (error) {
    logger.error('Error fetching own profile:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Update profile (authenticated)
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
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
    logger.error('Error queuing profile update:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};
