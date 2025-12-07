import { clerkClient } from '@clerk/express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { Verifier } from '../../utils/settings-token-verfier.js';

const CACHE_TTL = {
  USER_SUPPORT: 3600,
} as const;

const createSupportRequestSchema = z.object({
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters'),
  email: z.string().email('Valid email address is required for non-authenticated users').optional(),
});

export class SupportController {
  /**
   * Get user's support tickets
   */
  static async getUserSupportTickets(req: Request, res: Response) {
    try {
      const auth = await req.auth();
      const userId = auth?.userId;
      const readOnlyPrisma = getReadOnlyPrisma();

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      Verifier(req, res, auth);

      const cacheKey = `${REDIS_KEYS.USER_SUPPORT_CACHE}${userId}`;

      try {
        // Try cache first
        const cached = await redis.get(cacheKey);
        logger.info(`Support cache check for user ${userId}: ${cached ? 'HIT' : 'MISS'}`, {
          cacheKey,
          cachedType: typeof cached,
        });
        if (cached !== null && cached !== undefined) {
          try {
            logger.info('Returning cached support data', { userId });
            const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
            return res.status(200).json(parsedData);
          } catch (parseError) {
            logger.warn('Failed to parse cached support data, falling back to database', {
              error: parseError,
              userId,
            });
            // Continue to database query
          }
        }
      } catch (error) {
        logger.warn('Redis cache read failed for user support', { error, userId });
      }

      const supportTickets = await readOnlyPrisma.support.findMany({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const responseData = {
        success: true,
        supportTickets: supportTickets.map((ticket) => ({
          id: ticket.id,
          title: ticket.subject,
          description:
            ticket.message.length > 100 ? ticket.message.substring(0, 100) + '...' : ticket.message,
          status: ticket.status.toLowerCase(),
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        })),
      };

      // Cache the result
      try {
        await redis.setex(cacheKey, CACHE_TTL.USER_SUPPORT, JSON.stringify(responseData));
        logger.info('Support cache set successfully', { userId, cacheKey });
      } catch (error) {
        logger.warn('Redis cache write failed for user support', { error, userId });
      }

      res.status(200).json(responseData);
    } catch (error) {
      logger.error('Error fetching user support tickets:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private static readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
  private static readonly RATE_LIMIT_MAX_REQUESTS = 1; // 1 request per hour
  private static readonly RATE_LIMIT_MAX_REQUESTS_AUTHENTICATED = 3; // 3 requests per hour for authenticated users

  private static async checkRateLimit(req: Request, res: Response, next: Function) {
    try {
      const auth = req.auth();
      const identifier = auth?.userId || req.ip || 'anonymous';
      const key = `support_rate_limit:${identifier}`;

      const currentRequests = await redis.get(key);
      const requestCount =
        typeof currentRequests === 'string'
          ? parseInt(currentRequests, 10)
          : typeof currentRequests === 'number'
            ? currentRequests
            : 0;

      const maxRequests = auth?.userId
        ? SupportController.RATE_LIMIT_MAX_REQUESTS_AUTHENTICATED
        : SupportController.RATE_LIMIT_MAX_REQUESTS;

      if (requestCount >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Maximum ${maxRequests} support requests per hour allowed.`,
          retryAfter: SupportController.RATE_LIMIT_WINDOW / 1000,
        });
      }
      await redis.incr(key);

      // Set expiry if this is the first request
      if (requestCount === 0) {
        await redis.expire(key, SupportController.RATE_LIMIT_WINDOW / 1000);
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', { error });
      // Allow request to proceed if Redis fails
      next();
    }
  }

  /**
   * Create a new support request
   */
  static async createSupportRequest(req: Request, res: Response) {
    try {
      // Validate request body with zod
      const validationResult = createSupportRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.error.issues.map((err: import('zod').ZodIssue) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      const { subject, message, email } = validationResult.data;
      const auth = await req.auth();
      const userId = auth?.userId;
      let userEmail: string | undefined;
      let emailId: string | undefined;

      if (userId) {
        // Authenticated user - get email from user object
        const user = await clerkClient.users.getUser(userId);
        userEmail = user.emailAddresses[0]?.emailAddress;
        emailId = userEmail; // Store email for authenticated users too
      } else {
        // Non-authenticated user - require email in request
        if (!email) {
          return res.status(400).json({
            success: false,
            message: 'Email is required for non-authenticated users',
          });
        }
        emailId = email;
      }

      // Generate a temporary ID for immediate response
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send Inngest event for async processing
      await inngest.send({
        name: 'support/request-created',
        data: {
          tempId,
          userId,
          emailId,
          subject,
          message,
          userEmail,
          userName: null, // Will be resolved in Inngest
        },
      });

      // Invalidate user support cache
      if (userId) {
        const cacheKey = `${REDIS_KEYS.USER_SUPPORT_CACHE}${userId}`;
        try {
          await redis.del(cacheKey);
          logger.info('User support cache invalidated', { userId });
        } catch (error) {
          logger.warn('Failed to invalidate user support cache', { error, userId });
        }
      }

      // Return immediate success response
      res.status(201).json({
        success: true,
        message:
          'Support request submitted successfully. You will receive a confirmation email shortly.',
        data: {
          id: tempId,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error submitting support request:', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to submit support request',
      });
    }
  }

  static getRateLimitMiddleware() {
    return this.checkRateLimit;
  }
}
