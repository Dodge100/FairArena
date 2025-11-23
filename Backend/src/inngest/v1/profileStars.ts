import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const starProfile = inngest.createFunction(
  { id: 'profile.star' },
  { event: 'profile.star' },
  async ({ event }) => {
    const { profileId, userId } = event.data;

    try {
      logger.info(`Processing star: profile ${profileId} by user ${userId}`);

      // Verify user exists
      const starrer = await prisma.user.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });

      if (!starrer) {
        logger.warn(`Star failed: user ${userId} not found`);
        return { success: false, error: 'User not found' };
      }

      // Check if profile exists and is public
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { id: true, userId: true, isPublic: true },
      });

      if (!profile) {
        logger.warn(`Star failed: profile ${profileId} not found`);
        return { success: false, error: 'Profile not found' };
      }

      if (!profile.isPublic) {
        logger.warn(`Star failed: profile ${profileId} is not public`);
        return { success: false, error: 'Profile is not public' };
      }

      // Check if user is trying to star their own profile
      if (profile.userId === userId) {
        logger.warn(`Star failed: user ${userId} trying to star own profile`);
        return { success: false, error: 'Cannot star your own profile' };
      }

      // Check if already starred
      const existingStar = await prisma.profileStars.findFirst({
        where: {
          profileId,
          userId,
        },
      });

      if (existingStar) {
        logger.warn(`Star failed: profile ${profileId} already starred by ${userId}`);
        return { success: false, error: 'Profile already starred' };
      }

      // Create star
      const star = await prisma.profileStars.create({
        data: {
          profileId,
          userId,
        },
      });

      // Get starrer profile info
      const starrerUser = await prisma.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Invalidate cache
      await redis.del(`${REDIS_KEYS.PROFILE_CACHE}:${profile.userId}`);

      // Get updated star count
      const starCount = await prisma.profileStars.count({
        where: { profileId },
      });

      logger.info(`Successfully starred profile ${profileId} by user ${userId}`);

      return {
        success: true,
        data: {
          star: {
            id: star.id,
            profileId: star.profileId,
            userId: star.userId,
            createdAt: star.createdAt,
            starrer: {
              userId: starrerUser?.userId || userId,
              name:
                [starrerUser?.profile?.firstName, starrerUser?.profile?.lastName]
                  .filter(Boolean)
                  .join(' ') || 'Anonymous',
            },
          },
          starCount,
        },
      };
    } catch (error) {
      logger.error('Error processing star:', error);
      return { success: false, error: 'Internal server error' };
    }
  },
);

export const unstarProfile = inngest.createFunction(
  { id: 'profile.unstar' },
  { event: 'profile.unstar' },
  async ({ event }) => {
    const { profileId, userId } = event.data;

    try {
      logger.info(`Processing unstar: profile ${profileId} by user ${userId}`);

      // Verify user exists
      const starrer = await prisma.user.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });

      if (!starrer) {
        logger.warn(`Unstar failed: user ${userId} not found`);
        return { success: false, error: 'User not found' };
      }

      // Find and delete the star
      const starToDelete = await prisma.profileStars.findFirst({
        where: {
          profileId,
          userId,
        },
      });

      if (!starToDelete) {
        logger.warn(`Unstar failed: star not found for profile ${profileId} by ${userId}`);
        return { success: false, error: 'Star not found' };
      }

      // Get profile for cache invalidation
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { userId: true },
      });

      await prisma.profileStars.delete({
        where: { id: starToDelete.id },
      });

      // Invalidate cache
      if (profile) {
        await redis.del(`${REDIS_KEYS.PROFILE_CACHE}:${profile.userId}`);
      }

      // Get updated star count
      const starCount = await prisma.profileStars.count({
        where: { profileId },
      });

      logger.info(`Successfully unstarred profile ${profileId} by user ${userId}`);

      return {
        success: true,
        data: { starCount },
      };
    } catch (error) {
      logger.error('Error processing unstar:', error);
      return { success: false, error: 'Internal server error' };
    }
  },
);
