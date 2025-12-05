import { Request, Response } from 'express';
import { z } from 'zod';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { ENV } from '../../config/env.js';
import jwt from 'jsonwebtoken';

const readOnlyPrisma = getReadOnlyPrisma();
// Cache TTL: 24 hours
const SETTINGS_CACHE_TTL = 86400;

// Validation schema for settings
const updateSettingsSchema = z.object({
  wantToGetFeedbackMail: z.boolean().optional(),
  wantFeedbackNotifications: z.boolean().optional(),
});

export const getSettings = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      purpose: string;
    };

    if (decoded.purpose !== 'account-settings' || decoded.userId !== auth.userId) {
      logger.warn('Invalid token purpose', { purpose: decoded.purpose });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cacheKey = `${REDIS_KEYS.SETTINGS_CACHE}${auth.userId}`;

    // Try to get from cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info('Settings retrieved from cache', { userId: auth.userId });
        return res.json({
          success: true,
          data: cached,
        });
      }
    } catch (cacheError) {
      logger.warn('Redis cache read error', {
        userId: auth.userId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    logger.info('Fetching user settings from database', { userId: auth.userId });

    const settings = await readOnlyPrisma.settings.findUnique({
      where: { userId: auth.userId },
      select: {
        id: true,
        settings: true,
      },
    });

    // Settings should exist for all users (created during registration)
    if (!settings) {
      logger.error('Settings not found for user - this should not happen', { userId: auth.userId });
      return res.status(500).json({
        success: false,
        message: 'User settings not found. Please contact support.',
      });
    }

    // Cache the settings
    try {
      await redis.setex(cacheKey, SETTINGS_CACHE_TTL, settings.settings);
    } catch (cacheError) {
      logger.warn('Redis cache write error', {
        userId: auth.userId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    res.json({
      success: true,
      data: settings.settings,
    });
  } catch (error) {
    logger.error('Get settings error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth ? (await req.auth()).userId : 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

/**
 * Update user settings
 * PUT /api/v1/settings
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      purpose: string;
    };

    if (decoded.purpose !== 'account-settings' || decoded.userId !== auth.userId) {
      logger.warn('Invalid token purpose', { purpose: decoded.purpose });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate request body
    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings data',
        errors: validation.error.issues,
      });
    }

    // Trigger async settings update via Inngest
    await inngest.send({
      name: 'settings/update',
      data: {
        userId: auth.userId,
        updates: validation.data,
      },
    });

    // Respond immediately
    res.json({
      success: true,
      message: 'Settings update initiated',
    });
  } catch (error) {
    logger.error('Update settings error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth ? (await req.auth()).userId : 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

export const resetSettings = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      purpose: string;
    };

    if (decoded.purpose !== 'account-settings' || decoded.userId !== auth.userId) {
      logger.warn('Invalid token purpose', { purpose: decoded.purpose });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Trigger async settings reset via Inngest
    await inngest.send({
      name: 'settings/reset',
      data: {
        userId: auth.userId,
      },
    });

    res.json({
      success: true,
      message: 'Settings reset initiated',
    });
  } catch (error) {
    logger.error('Reset settings error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth ? (await req.auth()).userId : 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to reset settings' });
  }
};
