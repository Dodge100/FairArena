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

import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { redis, REDIS_KEYS } from '../../../config/redis.js';
import cloudinary from '../../../services/cloudinary.js';
import logger from '../../../utils/logger.js';

// Get upload signature for client-side upload
export const getUploadSignature = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `users/${userId}/profile`;

    // Parameters to sign (only include params that Cloudinary accepts)
    const paramsToSign: Record<string, any> = {
      timestamp,
      folder,
      eager: 'w_400,h_400,c_fill,g_face,q_auto,f_auto',
      allowed_formats: 'jpg,jpeg,png,webp',
    };

    // Remove undefined values
    Object.keys(paramsToSign).forEach((key) => {
      if (paramsToSign[key] === undefined) {
        delete paramsToSign[key];
      }
    });

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      cloudinary.config().api_secret!,
    );

    return res.status(200).json({
      success: true,
      data: {
        timestamp,
        folder,
        signature,
        apiKey: cloudinary.config().api_key,
        cloudName: cloudinary.config().cloud_name,
        eager: paramsToSign.eager,
        allowed_formats: paramsToSign.allowed_formats,
      },
    });
  } catch (error) {
    logger.error('Error generating Cloudinary signature', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
    });
  }
};

// Confirm upload and update user profile
const updateImageSchema = z.object({
  imageUrl: z.string().url(),
  publicId: z.string().min(1),
});

export const updateProfileImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = updateImageSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: result.error.issues,
      });
    }

    const { imageUrl, publicId } = result.data;

    // Update user profile image
    const updatedUser = await prisma.user.update({
      where: { userId },
      data: { profileImageUrl: imageUrl },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
      },
    });

    // Invalidate caches
    // 1. Auth Controller Profile Cache (Critical for instant update)
    // Matches cacheKey = `user:${userId}:profile` in authController.ts
    await redis.del(`user:${userId}:profile`);

    // 2. Generic Profile Cache (if used elsewhere)
    if (REDIS_KEYS.PROFILE_CACHE) {
      await redis.del(`${REDIS_KEYS.PROFILE_CACHE}${userId}`);
    }
    await redis.del(`user:cache:${userId}`);

    logger.info('Profile image updated', { userId, publicId });

    return res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    logger.error('Error updating profile image', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile image',
    });
  }
};
