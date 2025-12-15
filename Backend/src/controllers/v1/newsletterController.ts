import type { Request, Response } from 'express';
import { z } from 'zod';
import { redis } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 1; // 1 request per hour

async function checkRateLimit(req: Request, res: Response): Promise<boolean> {
  try {
    const identifier = req.ip || 'anonymous';
    const key = `newsletter_rate_limit:${identifier}`;

    const currentRequests = await redis.get(key);
    const requestCount =
      typeof currentRequests === 'string'
        ? parseInt(currentRequests, 10)
        : typeof currentRequests === 'number'
          ? currentRequests
          : 0;

    const maxRequests = RATE_LIMIT_MAX_REQUESTS;

    if (requestCount >= maxRequests) {
      res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Maximum ${maxRequests} newsletter requests per hour allowed.`,
        retryAfter: RATE_LIMIT_WINDOW / 1000,
      });
      return false;
    }

    await redis.incr(key);

    // Set expiry if this is the first request
    if (requestCount === 0) {
      await redis.expire(key, RATE_LIMIT_WINDOW / 1000);
    }

    return true;
  } catch (error) {
    logger.error('Rate limiting error:', { error });
    // Allow request to proceed if Redis fails
    return true;
  }
}

export async function subscribeToNewsletter(req: Request, res: Response) {
  try {
    if (!(await checkRateLimit(req, res))) {
      return;
    }

    const { email } = newsletterSchema.parse(req.body);

    logger.info('Newsletter subscription request received', { email });

    // Send event to Inngest for asynchronous processing
    await inngest.send({
      name: 'newsletter.subscribe',
      data: {
        email,
      },
    });

    logger.info('Newsletter subscription event sent to Inngest', { email });

    return res.status(200).json({
      success: true,
      message: 'Newsletter subscription request received!.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid newsletter subscription data', { errors: error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: error.issues,
      });
    }

    logger.error('Error processing newsletter subscription request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process newsletter subscription request',
    });
  }
}

export async function unsubscribeFromNewsletter(req: Request, res: Response) {
  try {
    if (!(await checkRateLimit(req, res))) {
      return;
    }

    const { email } = newsletterSchema.parse(req.body);

    logger.info('Newsletter unsubscribe request received', { email });

    // Send event to Inngest for asynchronous processing
    await inngest.send({
      name: 'newsletter.unsubscribe',
      data: {
        email,
      },
    });

    logger.info('Newsletter unsubscribe event sent to Inngest', { email });

    return res.status(200).json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid newsletter unsubscribe data', { errors: error.issues });
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: error.issues,
      });
    }

    logger.error('Error processing newsletter unsubscribe request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process newsletter unsubscribe request',
    });
  }
}
