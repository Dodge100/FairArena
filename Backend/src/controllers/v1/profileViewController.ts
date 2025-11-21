import { clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';

// Validation schemas
const profileIdSchema = z.string().min(1).max(255);

// Record profile view with consent
export const recordView = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const auth = req.auth();
    const viewerUserId = auth?.userId;

    if (!viewerUserId) {
      return res.status(401).json({
        error: { message: 'Authentication required', status: 401 },
      });
    }

    // Fetch user data from Clerk
    const clerkUser = await clerkClient.users.getUser(viewerUserId);
    const viewerEmail = clerkUser.primaryEmailAddress?.emailAddress;
    const viewerName =
      clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName || null;

    if (!viewerEmail) {
      return res.status(400).json({
        error: { message: 'Email not available', status: 400 },
      });
    }

    // Send event to Inngest for async processing
    await inngest.send({
      name: 'profile/view.record',
      data: {
        profileId,
        viewerUserId,
        viewerEmail,
        viewerName,
      },
    });

    return res.status(202).json({
      message: 'Profile view recorded',
      status: 'success',
    });
  } catch (error) {
    console.error('Error recording profile view:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};

// Get profile views for authenticated user
export const getProfileViews = async (req: Request, res: Response) => {
  try {
    const auth = req.auth();
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { message: 'Unauthorized - Authentication required', status: 401 },
      });
    }

    // Validate userId
    const validation = profileIdSchema.safeParse(userId);
    if (!validation.success) {
      return res.status(400).json({
        error: { message: 'Invalid user ID', status: 400 },
      });
    }

    const readOnlyPrisma = getReadOnlyPrisma();

    // Get user's profile
    const profile = await readOnlyPrisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return res.status(404).json({
        error: { message: 'Profile not found', status: 404 },
      });
    }

    // Get all views for this profile
    const views = await readOnlyPrisma.profileView.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        viewerUserId: true,
        viewerEmail: true,
        viewerName: true,
        createdAt: true,
      },
    });

    // Fetch Clerk user data for avatars
    const viewsWithAvatars = await Promise.all(
      views.map(async (view) => {
        try {
          const clerkUser = await clerkClient.users.getUser(view.viewerUserId);
          return {
            ...view,
            avatarUrl: clerkUser.imageUrl || null,
            viewedAt: view.createdAt.toISOString(),
          };
        } catch (error) {
          // If user not found in Clerk, return without avatar
          return {
            ...view,
            avatarUrl: null,
            viewedAt: view.createdAt.toISOString(),
          };
        }
      }),
    );

    return res.status(200).json({
      data: viewsWithAvatars,
    });
  } catch (error) {
    console.error('Error fetching profile views:', error);
    return res.status(500).json({
      error: { message: 'Internal server error', status: 500 },
    });
  }
};
