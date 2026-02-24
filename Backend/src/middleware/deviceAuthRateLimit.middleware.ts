/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Rate limiter for device authorization endpoint
 * Limits device authorization requests per client to prevent abuse
 *
 * Google-like limits:
 * - 10 requests per minute per client
 * - 100 requests per hour per client
 */
export async function deviceAuthRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const client = req.oauthClient;

  if (!client) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required',
    });
    return;
  }

  const clientId = client.clientId;
  const minuteKey = `device_auth_rate:${clientId}:minute`;
  const hourKey = `device_auth_rate:${clientId}:hour`;

  try {
    // Check minute limit (10 requests)
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60); // 1 minute
    }

    if (minuteCount > 10) {
      logger.warn('Device authorization rate limit exceeded (minute)', {
        clientId,
        count: minuteCount,
      });

      res.status(429).json({
        error: 'slow_down',
        error_description:
          'Too many device authorization requests. Please wait before trying again.',
      });
      return;
    }

    // Check hour limit (100 requests)
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 3600); // 1 hour
    }

    if (hourCount > 100) {
      logger.warn('Device authorization rate limit exceeded (hour)', {
        clientId,
        count: hourCount,
      });

      res.status(429).json({
        error: 'slow_down',
        error_description: 'Too many device authorization requests. Please try again later.',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Device authorization rate limit check failed', { error, clientId });
    // On error, allow the request to proceed (fail open)
    next();
  }
}

/**
 * Rate limiter for device verification endpoint (user entering code)
 * Prevents brute force attacks on user codes
 *
 * Limits:
 * - 5 failed attempts per IP per minute
 * - 20 failed attempts per IP per hour
 */
export async function deviceVerifyRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = req.ip || 'unknown';
  const minuteKey = `device_verify_rate:${ip}:minute`;
  const hourKey = `device_verify_rate:${ip}:hour`;

  try {
    // Check minute limit (5 attempts)
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60);
    }

    if (minuteCount > 5) {
      logger.warn('Device verification rate limit exceeded (minute)', {
        ip,
        count: minuteCount,
      });

      res.status(429).json({
        error: 'too_many_requests',
        error_description: 'Too many verification attempts. Please wait before trying again.',
      });
      return;
    }

    // Check hour limit (20 attempts)
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 3600);
    }

    if (hourCount > 20) {
      logger.warn('Device verification rate limit exceeded (hour)', {
        ip,
        count: hourCount,
      });

      res.status(429).json({
        error: 'too_many_requests',
        error_description: 'Too many verification attempts. Please try again later.',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Device verification rate limit check failed', { error, ip });
    // On error, allow the request to proceed (fail open)
    next();
  }
}

/**
 * Rate limiter for device consent endpoint
 * Prevents spam of consent approvals/denials
 *
 * Limits:
 * - 10 requests per user per minute
 */
export async function deviceConsentRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

  if (!userId) {
    // Will be caught by protectRoute middleware
    next();
    return;
  }

  const minuteKey = `device_consent_rate:${userId}:minute`;

  try {
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60);
    }

    if (minuteCount > 10) {
      logger.warn('Device consent rate limit exceeded', {
        userId,
        count: minuteCount,
      });

      res.status(429).json({
        error: 'too_many_requests',
        error_description: 'Too many consent requests. Please wait before trying again.',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Device consent rate limit check failed', { error, userId });
    // On error, allow the request to proceed (fail open)
    next();
  }
}
