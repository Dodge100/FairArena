import { Request, Response } from 'express';
import {
  getUserPresence,
  sendPresenceHeartbeat,
  updateUserPresence,
} from '../../services/v1/presenceService.js';
import logger from '../../utils/logger.js';

/**
 * Send presence heartbeat to keep user online
 */
export const heartbeat = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required' });
    }

    await sendPresenceHeartbeat(auth.userId, deviceId);

    return res.json({
      success: true,
      message: 'Heartbeat received',
    });
  } catch (error) {
    logger.error('Error processing heartbeat', { error });
    return res.status(500).json({ success: false, message: 'Failed to process heartbeat' });
  }
};

/**
 * Get user presence status
 */
export const getPresence = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const presence = await getUserPresence(auth.userId);

    return res.json({
      success: true,
      data: presence,
    });
  } catch (error) {
    logger.error('Error getting presence', { error });
    return res.status(500).json({ success: false, message: 'Failed to get presence' });
  }
};

/**
 * Update user presence (online/offline)
 */
export const updatePresence = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { deviceId, isOnline } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required' });
    }

    await updateUserPresence(auth.userId, deviceId, isOnline ?? true);

    return res.json({
      success: true,
      message: 'Presence updated',
    });
  } catch (error) {
    logger.error('Error updating presence', { error });
    return res.status(500).json({ success: false, message: 'Failed to update presence' });
  }
};
