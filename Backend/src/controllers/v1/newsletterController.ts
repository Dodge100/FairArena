import type { Request, Response } from 'express';
import { z } from 'zod';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function subscribeToNewsletter(req: Request, res: Response) {
  try {
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
