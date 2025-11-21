import { clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';

// Validation schemas
const userIdSchema = z.string().min(1).max(255);

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  yearsOfExperience: z.number().int().min(0).max(100).optional(),
  education: z.array(z.string().max(500)).max(20).optional(),
  skills: z.array(z.string().max(100)).max(100).optional(),
  languages: z.array(z.string().max(50)).max(50).optional(),
  interests: z.array(z.string().max(100)).max(50).optional(),
  githubUsername: z.string().max(100).optional(),
  twitterHandle: z.string().max(100).optional(),
  linkedInProfile: z.union([z.string().url().max(500), z.literal('')]).optional(),
  portfolioUrl: z.union([z.string().url().max(500), z.literal('')]).optional(),
  resumeUrl: z.union([z.string().url().max(500), z.literal('')]).optional(),
  isPublic: z.boolean().optional(),
  requireAuth: z.boolean().optional(),
  trackViews: z.boolean().optional(),
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
        education: true,
        skills: true,
        languages: true,
        interests: true,
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

    // Fetch Clerk user data for avatar
    let avatarUrl = null;
    try {
      const clerkUser = await clerkClient.users.getUser(profile.userId);
      avatarUrl = clerkUser.imageUrl || null;
    } catch (error) {
      console.error('Error fetching Clerk user:', error);
    }

    return res.status(200).json({
      data: {
        ...profileData,
        avatarUrl,
      },
      meta: {
        requiresConsent: shouldTrackViews && !hasConsent,
        isOwner: viewerUserId === profile.userId,
      },
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
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
    const profile = await readOnlyPrisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    return res.status(200).json({ data: profile });
  } catch (error) {
    console.error('Error fetching own profile:', error);
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
    console.error('Error queuing profile update:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};
