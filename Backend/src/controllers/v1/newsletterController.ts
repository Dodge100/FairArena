import type { Request, Response } from 'express';
import { z } from 'zod';
import { formRateLimiter } from '../../config/arcjet.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

const newsletterSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(
      /^[^+=.#]+@/,
      'Email subaddresses and special characters (+, =, ., #) are not allowed in the local part',
    ),
});

export async function subscribeToNewsletter(req: Request, res: Response) {
  try {
    const { email } = newsletterSchema.parse(req.body);

    const decision = await formRateLimiter.protect(req, { email });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        logger.warn('Email validation failed for newsletter subscription', {
          email,
          reason: decision.reason,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        logger.warn('Rate limit exceeded for newsletter subscription', { email });
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

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
    const { email } = newsletterSchema.parse(req.body);

    const decision = await formRateLimiter.protect(req, { email });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or disposable email address',
        });
      }

      if (decision.reason.isRateLimit()) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

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
