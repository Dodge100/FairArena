import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendMulticastPushNotification } from '../../services/v1/fcmService.js';
import { updateUserPresence } from '../../services/v1/presenceService.js';
import { extractDeviceInfo } from '../../utils/device-fingerprint.js';
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
    const clientDeviceId = req.body.deviceId; // Optional device ID from client

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

    // Extract device information from request
    const deviceInfo = extractDeviceInfo(req, clientDeviceId);

    // Save or update FCM token with device information
    const savedToken = await prisma.fCMToken.upsert({
      where: {
        userId_deviceId: {
          userId: auth.userId,
          deviceId: deviceInfo.deviceId,
        },
      },
      update: {
        token,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
        isActive: true,
        lastUsedAt: new Date(),
        failureCount: 0,
        lastFailureAt: null,
        lastFailureReason: null,
      },
      create: {
        userId: auth.userId,
        token,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
      },
    });

    // Update user presence - mark device as active
    await updateUserPresence(auth.userId, deviceInfo.deviceId, true);

    logger.info('FCM token saved with device info', {
      userId: auth.userId,
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
    });

    return res.json({
      success: true,
      message: 'FCM token saved successfully',
      deviceId: deviceInfo.deviceId,
    });
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

    const { token, deviceId } = req.body;

    let deletedCount = 0;
    let removedDeviceId: string | null = null;

    if (token) {
      // Get device ID before deletion for presence update
      const tokenRecord = await prisma.fCMToken.findFirst({
        where: {
          userId: auth.userId,
          token,
        },
        select: { deviceId: true },
      });

      removedDeviceId = tokenRecord?.deviceId || null;

      // Remove specific token
      const result = await prisma.fCMToken.deleteMany({
        where: {
          userId: auth.userId,
          token,
        },
      });
      deletedCount = result.count;
    } else if (deviceId) {
      // Remove token by device ID
      const result = await prisma.fCMToken.deleteMany({
        where: {
          userId: auth.userId,
          deviceId,
        },
      });
      deletedCount = result.count;
      removedDeviceId = deviceId;
    } else {
      // Remove all tokens for the user (for backward compatibility)
      const result = await prisma.fCMToken.deleteMany({
        where: { userId: auth.userId },
      });
      deletedCount = result.count;
    }

    // Update user presence - mark device as offline
    if (removedDeviceId) {
      await updateUserPresence(auth.userId, removedDeviceId, false);
    }

    logger.info('FCM token(s) removed', {
      userId: auth.userId,
      token: token || 'none',
      deviceId: deviceId || 'none',
      count: deletedCount,
    });

    return res.json({
      success: true,
      message: 'FCM token removed successfully',
      count: deletedCount,
    });
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

    // Get all active FCM tokens for the user
    const fcmTokens = await prisma.fCMToken.findMany({
      where: {
        userId: auth.userId,
        isActive: true,
      },
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
