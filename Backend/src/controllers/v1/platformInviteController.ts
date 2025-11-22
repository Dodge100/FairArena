import { clerkClient } from '@clerk/express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function inviteToPlatform(req: Request, res: Response) {
  try {
    const { email } = newsletterSchema.parse(req.body);

    // Get current user info
    const auth = await req.auth();
    if (!auth?.isAuthenticated) {
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

    // Fetch inviter data from Clerk
    const clerkUser = await clerkClient.users.getUser(inviterId);
    const inviterName =
      clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName || clerkUser.fullName || 'A user';

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
