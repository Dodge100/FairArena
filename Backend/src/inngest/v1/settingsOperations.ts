import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Centralized default settings - easily updatable for future changes
export const DEFAULT_USER_SETTINGS = {
  wantToGetFeedbackMail: true,
  wantFeedbackNotifications: true,
  pushNotificationsEnabled: false,
};

// Settings cache TTL: 24 hours
const SETTINGS_CACHE_TTL = 86400;

interface SettingsUpdateData {
  wantToGetFeedbackMail?: boolean;
  wantFeedbackNotifications?: boolean;
  pushNotificationsEnabled?: boolean;
}

/**
 * Create default settings for a new user
 */
export const createUserSettingsFunction = inngest.createFunction(
  {
    id: 'user-settings-create',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'user.settings.create' },
  async ({ event }) => {
    const { userId } = event.data as { userId: string };

    logger.info('Creating default settings for new user', { userId });

    try {
      // Check if settings already exist (shouldn't happen, but safety check)
      const existingSettings = await prisma.settings.findUnique({
        where: { userId },
      });

      if (existingSettings) {
        logger.info('Settings already exist for user, skipping creation', { userId });
        return { success: true, message: 'Settings already exist' };
      }

      // Create default settings
      const newSettings = await prisma.settings.create({
        data: {
          userId,
          settings: DEFAULT_USER_SETTINGS,
        },
      });

      // Cache the settings
      const cacheKey = `${REDIS_KEYS.SETTINGS_CACHE}${userId}`;
      await redis.setex(cacheKey, SETTINGS_CACHE_TTL, JSON.stringify(DEFAULT_USER_SETTINGS));

      logger.info('Default settings created successfully for user', { userId });

      return { success: true, settingsId: newSettings.id };
    } catch (error) {
      logger.error('Failed to create default settings for user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

/**
 * Update user settings
 */
export const updateSettingsFunction = inngest.createFunction(
  {
    id: 'settings-update',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'settings/update' },
  async ({ event }) => {
    const { userId, updates } = event.data as { userId: string; updates: SettingsUpdateData };

    logger.info('Processing settings update', { userId });

    try {
      // Get current settings
      let currentSettings = await prisma.settings.findUnique({
        where: { userId },
      });

      if (!currentSettings) {
        currentSettings = await prisma.settings.create({
          data: {
            userId,
            settings: DEFAULT_USER_SETTINGS,
          },
        });
      }

      // Merge settings
      const currentData = currentSettings.settings as typeof DEFAULT_USER_SETTINGS;
      const updatedData = {
        ...currentData,
        ...updates,
      };

      // Update in database
      await prisma.settings.update({
        where: { userId },
        data: { settings: updatedData },
      });

      // Invalidate cache
      const cacheKey = `${REDIS_KEYS.SETTINGS_CACHE}${userId}`;
      try {
        await redis.del(cacheKey);
        // Set new cache
        await redis.setex(cacheKey, SETTINGS_CACHE_TTL, updatedData);
        logger.info('Settings cache updated', { userId });
      } catch (cacheError) {
        logger.warn('Failed to update settings cache', {
          userId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        });
      }

      logger.info('Settings updated successfully', { userId });
    } catch (error) {
      logger.error('Failed to update settings', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

/**
 * Reset user settings to default
 */
export const resetSettingsFunction = inngest.createFunction(
  {
    id: 'settings-reset',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'settings/reset' },
  async ({ event }) => {
    const { userId } = event.data as { userId: string };

    logger.info('Processing settings reset', { userId });

    try {
      // Upsert settings with defaults
      await prisma.settings.upsert({
        where: { userId },
        update: { settings: DEFAULT_USER_SETTINGS },
        create: {
          userId,
          settings: DEFAULT_USER_SETTINGS,
        },
      });

      // Invalidate and update cache
      const cacheKey = `${REDIS_KEYS.SETTINGS_CACHE}${userId}`;
      try {
        await redis.del(cacheKey);
        await redis.setex(cacheKey, SETTINGS_CACHE_TTL, DEFAULT_USER_SETTINGS);
        logger.info('Settings cache reset', { userId });
      } catch (cacheError) {
        logger.warn('Failed to reset settings cache', {
          userId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        });
      }

      logger.info('Settings reset successfully', { userId });
    } catch (error) {
      logger.error('Failed to reset settings', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
