import type { Request, Response } from 'express';
import { z } from 'zod';
import { RATE_LIMIT_CONFIG, REDIS_KEYS, redis } from '../../config/redis.js';
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

    // Check rate limiting for platform invites
    const inviteKey = `${REDIS_KEYS.PLATFORM_INVITE_ATTEMPTS}${inviterId}`;
    const inviteLockoutKey = `${REDIS_KEYS.PLATFORM_INVITE_LOCKOUT}${inviterId}`;

    // Check if user is currently locked out from sending invites
    const inviteLockoutUntil = await redis.get(inviteLockoutKey);
    if (inviteLockoutUntil && typeof inviteLockoutUntil === 'string') {
      const remainingMinutes = Math.ceil((parseInt(inviteLockoutUntil) - Date.now()) / (60 * 1000));
      logger.warn('User is locked out from sending platform invites', {
        userId: inviterId,
        remainingMinutes,
      });
      return res.status(429).json({
        success: false,
        message: `Too many invite attempts. Please try again in ${remainingMinutes} minutes.`,
        retryAfter: remainingMinutes * 60,
      });
    }

    // Atomically increment invite attempts and set expiry if first attempt
    const luaScript = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;
    const expirySeconds = RATE_LIMIT_CONFIG.PLATFORM_INVITE_WINDOW_MINUTES * 60;
    const currentInviteAttempts = Number(await redis.eval(luaScript, [inviteKey], [expirySeconds]));

    if (currentInviteAttempts > RATE_LIMIT_CONFIG.PLATFORM_INVITE_MAX_ATTEMPTS) {
      // Lock out the user from sending invites
      const inviteLockoutUntil =
        Date.now() + RATE_LIMIT_CONFIG.PLATFORM_INVITE_LOCKOUT_MINUTES * 60 * 1000;
      await redis.set(inviteLockoutKey, inviteLockoutUntil.toString(), {
        ex: RATE_LIMIT_CONFIG.PLATFORM_INVITE_LOCKOUT_MINUTES * 60,
      });
      logger.warn('User locked out from sending platform invites after too many requests', {
        userId: inviterId,
        attempts: currentInviteAttempts,
      });
      return res.status(429).json({
        success: false,
        message: `Too many invite attempts. Please try again in ${RATE_LIMIT_CONFIG.PLATFORM_INVITE_LOCKOUT_MINUTES} minutes.`,
        retryAfter: RATE_LIMIT_CONFIG.PLATFORM_INVITE_LOCKOUT_MINUTES * 60,
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
