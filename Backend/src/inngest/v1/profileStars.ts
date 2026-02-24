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

import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const starProfile = inngest.createFunction(
  {
    id: 'profile.star',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
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

      // Use transaction to prevent race conditions
      const star = await prisma.$transaction(async (tx) => {
        // Check if already starred
        const existingStar = await tx.profileStars.findFirst({
          where: {
            profileId,
            userId,
          },
        });

        if (existingStar) {
          logger.warn(`Star failed: profile ${profileId} already starred by ${userId}`);
          throw new Error('Profile already starred');
        }

        // Create star
        return await tx.profileStars.create({
          data: {
            profileId,
            userId,
          },
        });
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

      // Invalidate caches
      await redis.del(`${REDIS_KEYS.PROFILE_CACHE}${profile.userId}`);
      // Invalidate the star status cache for this viewer
      await redis.del(`${REDIS_KEYS.PROFILE_STAR}${profileId}:${userId}`);

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
      logger.error('Error processing star:', { error });

      // Handle specific transaction errors
      if (error instanceof Error && error.message === 'Profile already starred') {
        return { success: false, error: 'Profile already starred' };
      }

      return { success: false, error: 'Internal server error' };
    }
  },
);

export const unstarProfile = inngest.createFunction(
  {
    id: 'profile.unstar',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
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

      // Use transaction to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        // Find the star
        const starToDelete = await tx.profileStars.findFirst({
          where: {
            profileId,
            userId,
          },
        });

        if (!starToDelete) {
          logger.warn(`Unstar failed: star not found for profile ${profileId} by ${userId}`);
          throw new Error('Star not found');
        }

        // Get profile for cache invalidation
        const profile = await tx.profile.findUnique({
          where: { id: profileId },
          select: { userId: true },
        });

        // Delete the star
        await tx.profileStars.delete({
          where: { id: starToDelete.id },
        });

        return { profile };
      });

      const { profile } = result;

      // Invalidate caches
      if (profile) {
        await redis.del(`${REDIS_KEYS.PROFILE_CACHE}${profile.userId}`);
        // Invalidate the star status cache for this viewer
        await redis.del(`${REDIS_KEYS.PROFILE_STAR}${profileId}:${userId}`);
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
      logger.error('Error processing unstar:', { error });

      // Handle specific transaction errors
      if (error instanceof Error && error.message === 'Star not found') {
        return { success: false, error: 'Star not found' };
      }

      return { success: false, error: 'Internal server error' };
    }
  },
);
