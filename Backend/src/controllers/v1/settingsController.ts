import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import { DEFAULT_USER_SETTINGS } from '../../inngest/v1/settingsOperations.js';
import logger from '../../utils/logger.js';
import { Verifier } from '../../utils/settings-token-verfier.js';

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
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    Verifier(req, res, auth);

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
    // If not found, create them now
    let settingsData;
    if (!settings) {
      logger.warn('Settings not found for user - creating default settings', {
        userId: auth.userId,
      });

      try {
        const newSettings = await prisma.settings.create({
          data: {
            userId: auth.userId,
            settings: DEFAULT_USER_SETTINGS,
          },
          select: {
            id: true,
            settings: true,
          },
        });
        settingsData = newSettings.settings;
      } catch (createError) {
        logger.error('Failed to create default settings', {
          userId: auth.userId,
          error: createError instanceof Error ? createError.message : String(createError),
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize user settings. Please try again.',
        });
      }
    } else {
      settingsData = settings.settings;
    }

    // Merge with defaults to ensure all fields are present
    const mergedSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...(typeof settingsData === 'object' && settingsData !== null ? settingsData : {}),
    };

    // Cache the settings
    try {
      await redis.setex(cacheKey, SETTINGS_CACHE_TTL, mergedSettings);
    } catch (cacheError) {
      logger.warn('Redis cache write error', {
        userId: auth.userId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    res.json({
      success: true,
      data: mergedSettings,
    });
  } catch (error) {
    logger.error('Get settings error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId ?? 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    Verifier(req, res, auth);

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
      userId: req.user?.userId ?? 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

export const resetSettings = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    Verifier(req, res, auth);

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
      userId: req.user?.userId ?? 'unknown',
    });
    res.status(500).json({ success: false, message: 'Failed to reset settings' });
  }
};
