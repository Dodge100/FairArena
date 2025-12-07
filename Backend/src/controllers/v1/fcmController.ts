import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendMulticastPushNotification } from '../../services/v1/fcmService.js';
import logger from '../../utils/logger.js';

export const saveFCMToken = async (req: Request, res: Response) => {
  let auth: { userId?: string; isAuthenticated?: boolean } | null = null;
  let token: string = '';

  try {
    auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    token = req.body.token;

    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { userId: auth.userId },
      select: { userId: true },
    });

    if (!user) {
      logger.error('User not found when saving FCM token', { userId: auth.userId });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Save FCM token to the new table
    await prisma.fCMToken.upsert({
      where: { token },
      update: {
        updatedAt: new Date(),
      },
      create: {
        userId: auth.userId,
        token,
      },
    });

    logger.info('FCM token saved', { userId: auth.userId });

    return res.json({ success: true, message: 'FCM token saved successfully' });
  } catch (error) {
    logger.error('Error saving FCM token', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth?.userId,
      token: token ? 'present' : 'missing',
    });
    return res.status(500).json({ success: false, message: 'Failed to save FCM token' });
  }
};

export const removeFCMToken = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { token } = req.body;

    if (token) {
      // Remove specific token
      await prisma.fCMToken.deleteMany({
        where: {
          userId: auth.userId,
          token,
        },
      });
    } else {
      // Remove all tokens for the user (for backward compatibility)
      await prisma.fCMToken.deleteMany({
        where: { userId: auth.userId },
      });
    }

    logger.info('FCM token(s) removed', { userId: auth.userId, token: token || 'all' });

    return res.json({ success: true, message: 'FCM token removed successfully' });
  } catch (error) {
    logger.error('Error removing FCM token', { error });
    return res.status(500).json({ success: false, message: 'Failed to remove FCM token' });
  }
};

export const testPushNotification = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get all FCM tokens for the user
    const fcmTokens = await prisma.fCMToken.findMany({
      where: { userId: auth.userId },
      select: { token: true },
    });

    if (!fcmTokens || fcmTokens.length === 0) {
      return res.status(400).json({ success: false, message: 'No FCM token found' });
    }

    // Send to all tokens
    const tokens = fcmTokens.map((t: { token: string }) => t.token);
    const result = await sendMulticastPushNotification(tokens, {
      title: 'Test Notification',
      body: 'This is a test push notification from FairArena',
      data: { type: 'TEST' },
    });

    if (result.successCount > 0) {
      return res.json({
        success: true,
        message: `Test notification sent to ${result.successCount} device(s)`,
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to send notification to any device' });
    }
  } catch (error) {
    logger.error('Error sending test notification', { error });
    return res.status(500).json({ success: false, message: 'Failed to send test notification' });
  }
};
