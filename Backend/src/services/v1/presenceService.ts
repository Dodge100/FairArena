import { redis } from '../../config/redis.js';
import logger from '../../utils/logger.js';

const PRESENCE_KEY_PREFIX = 'user:presence:';
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const PRESENCE_TTL = 600; // 10 minutes

export interface UserPresenceData {
  userId: string;
  isOnline: boolean;
  lastSeenAt: Date;
  activeDeviceIds: string[];
}

/**
 * Update user presence - mark user as online with active devices
 */
export async function updateUserPresence(
  userId: string,
  deviceId: string,
  isOnline: boolean = true,
): Promise<void> {
  try {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const now = Date.now();

    if (isOnline) {
      // Add device to active devices set
      await redis.sadd(`${key}:devices`, deviceId);
      await redis.set(`${key}:lastSeen`, now.toString());
      await redis.set(`${key}:online`, '1');
      await redis.expire(key, PRESENCE_TTL);
      await redis.expire(`${key}:devices`, PRESENCE_TTL);
      await redis.expire(`${key}:lastSeen`, PRESENCE_TTL);
      await redis.expire(`${key}:online`, PRESENCE_TTL);
    } else {
      // Remove device from active devices
      await redis.srem(`${key}:devices`, deviceId);

      // Check if any devices are still active
      const activeDevices = await redis.smembers(`${key}:devices`);
      if (activeDevices.length === 0) {
        await redis.set(`${key}:online`, '0');
        await redis.set(`${key}:lastSeen`, now.toString());
      }
    }

    logger.debug('User presence updated', { userId, deviceId, isOnline });
  } catch (error) {
    logger.error('Error updating user presence', { error, userId, deviceId });
  }
}

/**
 * Get user presence status
 */
export async function getUserPresence(userId: string): Promise<UserPresenceData> {
  try {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;

    const [isOnlineStr, lastSeenStr, activeDeviceIds] = await Promise.all([
      redis.get(`${key}:online`),
      redis.get(`${key}:lastSeen`),
      redis.smembers(`${key}:devices`),
    ]);

    const isOnline = isOnlineStr === '1';
    const lastSeenAt = lastSeenStr ? new Date(parseInt(String(lastSeenStr))) : new Date();

    // Double-check online status based on last seen time
    const isRecentlyActive = Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;

    return {
      userId,
      isOnline: isOnline && isRecentlyActive,
      lastSeenAt,
      activeDeviceIds: activeDeviceIds || [],
    };
  } catch (error) {
    logger.error('Error getting user presence', { error, userId });
    return {
      userId,
      isOnline: false,
      lastSeenAt: new Date(),
      activeDeviceIds: [],
    };
  }
}

/**
 * Get multiple users' presence status in batch
 */
export async function getBatchUserPresence(
  userIds: string[],
): Promise<Map<string, UserPresenceData>> {
  const presenceMap = new Map<string, UserPresenceData>();

  try {
    const promises = userIds.map((userId) => getUserPresence(userId));
    const results = await Promise.all(promises);

    results.forEach((presence) => {
      presenceMap.set(presence.userId, presence);
    });
  } catch (error) {
    logger.error('Error getting batch user presence', { error, userIds });
  }

  return presenceMap;
}

/**
 * Check if user is online
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const presence = await getUserPresence(userId);
    return presence.isOnline;
  } catch (error) {
    logger.error('Error checking if user is online', { error, userId });
    return false;
  }
}

/**
 * Get user's active device IDs
 */
export async function getActiveDevices(userId: string): Promise<string[]> {
  try {
    const key = `${PRESENCE_KEY_PREFIX}${userId}:devices`;
    return await redis.smembers(key);
  } catch (error) {
    logger.error('Error getting active devices', { error, userId });
    return [];
  }
}

/**
 * Mark user as offline and clear all active devices
 */
export async function markUserOffline(userId: string): Promise<void> {
  try {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    await redis.set(`${key}:online`, '0');
    await redis.set(`${key}:lastSeen`, Date.now().toString());
    await redis.del(`${key}:devices`);

    logger.debug('User marked as offline', { userId });
  } catch (error) {
    logger.error('Error marking user as offline', { error, userId });
  }
}

/**
 * Heartbeat to keep presence alive
 */
export async function sendPresenceHeartbeat(userId: string, deviceId: string): Promise<void> {
  try {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;

    // Refresh TTLs
    await redis.expire(key, PRESENCE_TTL);
    await redis.expire(`${key}:devices`, PRESENCE_TTL);
    await redis.expire(`${key}:lastSeen`, PRESENCE_TTL);
    await redis.expire(`${key}:online`, PRESENCE_TTL);

    // Update last seen
    await redis.set(`${key}:lastSeen`, Date.now().toString());

    logger.debug('Presence heartbeat sent', { userId, deviceId });
  } catch (error) {
    logger.error('Error sending presence heartbeat', { error, userId, deviceId });
  }
}
