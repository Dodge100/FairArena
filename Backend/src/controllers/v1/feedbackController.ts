import { Request, Response } from 'express';
import { z } from 'zod';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

// Read-only Prisma client
const readOnlyPrisma = getReadOnlyPrisma();

// Rate limiting: 1 feedback submission per 60 seconds
const FEEDBACK_RATE_LIMIT_SECONDS = 60;

// Validation schema for feedback submission
const submitFeedbackSchema = z.object({
  message: z.string().max(1000).optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const getFeedback = async (req: Request, res: Response) => {
  try {
    const { feedbackCode } = req.params;

    if (!feedbackCode) {
      return res.status(400).json({ success: false, message: 'Feedback code is required' });
    }

    const feedback = await readOnlyPrisma.feedback.findUnique({
      where: { feedbackCode: feedbackCode as string },
      select: {
        id: true,
        feedbackCode: true,
        message: true,
        rating: true,
        isUsed: true,
        createdAt: true,
      },
    });

    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    logger.info('Feedback retrieved', { feedbackCode, isUsed: feedback.isUsed });

    res.json({ success: true, data: feedback });
  } catch (error) {
    logger.error('Get feedback error', {
      error: error instanceof Error ? error.message : String(error),
      feedbackCode: req.params.feedbackCode,
    });
    res.status(500).json({ success: false, message: 'Failed to retrieve feedback' });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { feedbackCode } = req.params;

    if (!feedbackCode) {
      return res.status(400).json({ success: false, message: 'Feedback code is required' });
    }

    // Validate request body
    const validation = submitFeedbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: validation.error.issues,
      });
    }

    const { message, rating } = validation.data;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }

    if (message && message.length > 1000) {
      return res
        .status(400)
        .json({ success: false, message: 'Message exceeds maximum length of 1000 characters' });
    }
    // Check rate limiting
    const rateLimitKey = `${REDIS_KEYS.FEEDBACK_RATE_LIMIT}${feedbackCode}`;
    try {
      const lastSubmit = await redis.get(rateLimitKey);
      if (lastSubmit) {
        const ttl = await redis.ttl(rateLimitKey);
        return res.status(429).json({
          success: false,
          message: `Please wait ${ttl} seconds before submitting again`,
          retryAfter: ttl,
        });
      }
    } catch (redisError) {
      logger.warn('Redis rate limit check failed', {
        feedbackCode,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
    }

    // Check if feedback exists and is not used
    const existingFeedback = await readOnlyPrisma.feedback.findUnique({
      where: { feedbackCode: feedbackCode as string },
      select: { id: true, isUsed: true },
    });

    if (!existingFeedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    if (existingFeedback.isUsed) {
      return res.status(409).json({ success: false, message: 'Feedback already submitted' });
    }

    // Set rate limit
    try {
      await redis.setex(rateLimitKey, FEEDBACK_RATE_LIMIT_SECONDS, '1');
    } catch (redisError) {
      logger.warn('Failed to set rate limit', {
        feedbackCode,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
    }

    // Process feedback submission asynchronously via Inngest
    await inngest.send({
      name: 'feedback/submit',
      data: {
        feedbackCode,
        message: message || null,
        rating: rating || null,
      },
    });

    logger.info('Feedback submission initiated', {
      feedbackCode,
      hasMessage: !!message,
      rating,
    });

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    logger.error('Submit feedback error', {
      error: error instanceof Error ? error.message : String(error),
      feedbackCode: req.params.feedbackCode,
    });
    res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
};
