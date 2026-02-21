import type { Request, Response } from 'express';
import { z } from 'zod';
import { formRateLimiter } from '../../config/arcjet.js';
import { prisma } from '../../config/database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getCachedUserInfo, getUserDisplayName } from '../../utils/userCache.js';

const newsletterSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(
      /^[^+=.#]+@/,
      'Email subaddresses and special characters (+, =, ., #) are not allowed in the local part',
    ),
});

export async function inviteToPlatform(req: Request, res: Response) {
  try {
    const { email } = newsletterSchema.parse(req.body);

    // Arcjet Protection
    const decision = await formRateLimiter.protect(req, { email });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        logger.warn('Email validation failed during platform invite', {
          email,
          reason: decision.reason,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        logger.warn('Rate limit exceeded during platform invite', { email });
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get current user info
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - you must be logged in',
      });
    }

    const inviterId = auth.userId;
    if (!inviterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - invalid user',
      });
    }

    // Fetch inviter data from database with caching
    const userInfo = await getCachedUserInfo(inviterId);
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user already exists to prevent enumeration
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      logger.info('Platform invite skipped - user already exists', { email, inviterId });
      // Return success to prevent enumeration
      return res.status(200).json({
        success: true,
        message: 'Platform invite request received!',
      });
    }

    const inviterName = getUserDisplayName(userInfo);

    logger.info('Platform Invite request received', { email, inviterName });

    // Send event to Inngest for asynchronous processing
    await inngest.send({
      name: 'platform.invite',
      data: {
        email,
        inviterName,
      },
    });

    logger.info('Platform invite event sent to Inngest', { email, inviterName });

    return res.status(200).json({
      success: true,
      message: 'Platform invite request received!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid platform invite data', { errors: error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: error.issues,
      });
    }

    logger.error('Error processing platform invite request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process platform invite request',
    });
  }
}
