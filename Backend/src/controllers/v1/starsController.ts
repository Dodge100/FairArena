import { clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
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
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

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

    // Get stars with starrer info
    const [stars, totalCount] = await Promise.all([
      prisma.profileStars.findMany({
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
        skip,
        take: limitNum,
      }),
      prisma.profileStars.count({
        where: { profileId: profile.id },
      }),
    ]);

    // Fetch avatar URLs from Clerk and format stars
    const formattedStars = await Promise.all(
      stars.map(async (star) => {
        let avatarUrl = null;
        try {
          const clerkUser = await clerkClient.users.getUser(star.userId);
          avatarUrl = clerkUser.imageUrl || null;
        } catch (error) {
          logger.warn(`Failed to fetch avatar for user ${star.userId}:`, error);
        }

        return {
          id: star.id,
          userId: star.userId,
          createdAt: star.createdAt,
          starrer: {
            userId: star.user.userId,
            name:
              [star.user.profile?.firstName, star.user.profile?.lastName]
                .filter(Boolean)
                .join(' ') || 'Anonymous',
            avatarUrl,
          },
        };
      }),
    );

    res.json({
      success: true,
      data: {
        stars: formattedStars,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
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
