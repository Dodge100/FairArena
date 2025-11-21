import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { RATE_LIMIT_CONFIG, redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

// Constants for OTP verification
const TOKEN_EXPIRY_MINUTES = 10;

// Validation schemas
const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only digits'),
});

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info('Sending OTP for account settings', { userId: auth.userId });

    // Check rate limiting for OTP sending
    const sendKey = `${REDIS_KEYS.OTP_SEND_ATTEMPTS}${auth.userId}:account-settings`;
    const sendLockoutKey = `${REDIS_KEYS.OTP_SEND_LOCKOUT}${auth.userId}:account-settings`;

    // Check if user is currently locked out from sending OTPs
    const sendLockoutUntil = await redis.get(sendLockoutKey);
    if (sendLockoutUntil && typeof sendLockoutUntil === 'string') {
      const remainingMinutes = Math.ceil((parseInt(sendLockoutUntil) - Date.now()) / (60 * 1000));
      logger.warn('User is locked out from sending OTP', {
        userId: auth.userId,
        remainingMinutes,
      });
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Please try again in ${remainingMinutes} minutes.`,
        retryAfter: remainingMinutes * 60,
      });
    }

    // Check send attempts
    const currentSendAttempts = await redis.incr(sendKey);

    // Set expiry on the send attempts key if this is the first attempt
    if (currentSendAttempts === 1) {
      await redis.expire(sendKey, RATE_LIMIT_CONFIG.SEND_WINDOW_MINUTES * 60);
    }

    if (currentSendAttempts > RATE_LIMIT_CONFIG.MAX_SEND_ATTEMPTS) {
      // Lock out the user from sending OTPs
      const sendLockoutUntil = Date.now() + RATE_LIMIT_CONFIG.SEND_LOCKOUT_MINUTES * 60 * 1000;
      await redis.set(sendLockoutKey, sendLockoutUntil.toString(), {
        ex: RATE_LIMIT_CONFIG.SEND_LOCKOUT_MINUTES * 60,
      });
      logger.warn('User locked out from sending OTP after too many requests', {
        userId: auth.userId,
        attempts: currentSendAttempts,
      });
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Please try again in ${RATE_LIMIT_CONFIG.SEND_LOCKOUT_MINUTES} minutes.`,
        retryAfter: RATE_LIMIT_CONFIG.SEND_LOCKOUT_MINUTES * 60,
      });
    }

    await inngest.send({
      name: 'account-settings/send-otp',
      data: { userId: auth.userId },
    });

    inngest.send({
      name: 'log.create',
      data: {
        userId: auth.userId,
        action: 'sensitive-action-attempted',
        level: 'WARN',
      },
    });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    logger.error('Send OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Validate OTP format
    const validation = verifyOtpSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid OTP format', {
        userId: auth.userId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        success: false,
        message: 'OTP must be 6 digits',
      });
    }

    const { otp } = validation.data;

    logger.info('Verifying OTP for account settings', { userId: auth.userId });

    // Check for rate limiting (brute force protection) using Redis
    const attemptKey = `${REDIS_KEYS.OTP_ATTEMPTS}${auth.userId}:account-settings`;
    const lockoutKey = `${REDIS_KEYS.OTP_LOCKOUT}${auth.userId}:account-settings`;

    // Check if user is currently locked out
    const lockoutUntil = await redis.get(lockoutKey);
    if (lockoutUntil && typeof lockoutUntil === 'string') {
      const remainingMinutes = Math.ceil((parseInt(lockoutUntil) - Date.now()) / (60 * 1000));
      logger.warn('User is locked out from OTP verification', {
        userId: auth.userId,
        remainingMinutes,
      });
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
        retryAfter: remainingMinutes * 60, // seconds
      });
    }

    // Find the most recent non-verified OTP for this user and purpose
    const otpRecord = await getReadOnlyPrisma().otp.findFirst({
      where: {
        userId: auth.userId,
        sentFor: 'account-settings',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      logger.warn('No valid OTP found', { userId: auth.userId });
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found',
      });
    }

    // Verify the OTP
    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isValid) {
      // Increment failed attempts in Redis
      const currentAttempts = await redis.incr(attemptKey);

      // Set expiry on the attempts key if this is the first attempt
      if (currentAttempts === 1) {
        await redis.expire(attemptKey, RATE_LIMIT_CONFIG.WINDOW_MINUTES * 60);
      }

      if (currentAttempts >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
        // Lock out the user
        const lockoutUntil = Date.now() + RATE_LIMIT_CONFIG.LOCKOUT_MINUTES * 60 * 1000;
        await redis.set(lockoutKey, lockoutUntil.toString(), {
          ex: RATE_LIMIT_CONFIG.LOCKOUT_MINUTES * 60,
        });
        logger.warn('User locked out after too many failed OTP attempts', {
          userId: auth.userId,
          attempts: currentAttempts,
        });
        return res.status(429).json({
          success: false,
          message: `Too many failed attempts. Please try again in ${RATE_LIMIT_CONFIG.LOCKOUT_MINUTES} minutes.`,
          retryAfter: RATE_LIMIT_CONFIG.LOCKOUT_MINUTES * 60, // seconds
        });
      }

      logger.warn('Invalid OTP provided', { userId: auth.userId, attempts: currentAttempts });
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Success - clear any previous failed attempts
    await redis.del(attemptKey);
    await redis.del(lockoutKey);

    // Mark only this specific OTP as verified (keep others for audit trail)
    await prisma.otp.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        verified: true,
      },
    });

    // Generate JWT token for account settings access
    const token = jwt.sign({ userId: auth.userId, purpose: 'account-settings' }, ENV.JWT_SECRET, {
      expiresIn: `${TOKEN_EXPIRY_MINUTES}m`,
    });

    // Set secure cookie
    res.cookie('account-settings-token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY_MINUTES * 60 * 1000, // 10 minutes
    });

    inngest.send({
      name: 'log.create',
      data: {
        userId: auth.userId,
        action: 'sensitive-action-verified',
        level: 'CRITICAL',
      },
    });

    logger.info('OTP verified successfully', { userId: auth.userId });
    res.json({ success: true, message: 'Verification successful' });
  } catch (error) {
    logger.error('Verify OTP error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

export const checkStatus = async (req: Request, res: Response) => {
  try {
    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.json({ success: false, verified: false });
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
        userId: string;
        purpose: string;
      };

      // Verify the token is for account settings
      if (decoded.purpose !== 'account-settings') {
        logger.warn('Invalid token purpose', { purpose: decoded.purpose });
        return res.json({ success: false, verified: false });
      }

      res.json({ success: true, verified: true });
    } catch (jwtError) {
      logger.warn('Invalid or expired token', {
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
      });
      res.json({ success: false, verified: false });
    }
  } catch (error) {
    logger.error('Status check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Status check failed' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  try {
    const token = req.cookies['account-settings-token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
        userId: string;
        purpose: string;
      };

      // Verify the token is for account settings
      if (decoded.purpose !== 'account-settings') {
        logger.warn('Invalid token purpose', { purpose: decoded.purpose });
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      inngest.send({
        name: 'log.create',
        data: {
          userId: decoded.userId,
          action: 'logs-accessed',
          level: 'CRITICAL',
        },
      });

      const logs = await getReadOnlyPrisma().logs.findMany({
        where: {
          userId: decoded.userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          action: true,
          level: true,
          metadata: true,
          createdAt: true,
        },
      });

      res.json({ success: true, logs });
    } catch (jwtError) {
      logger.warn('Invalid or expired token', {
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
      });
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  } catch (error) {
    logger.error('Get logs error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};
