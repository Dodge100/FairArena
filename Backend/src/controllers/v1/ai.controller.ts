import { Request, Response } from 'express';
import { z } from 'zod';
import { redis } from '../../config/redis.js';
import { aiService } from '../../services/v1/ai.service.js';
import logger from '../../utils/logger.js';

// Validation schemas
const createChatRequestSchema = () =>
  z.object({
    message: z.string().min(1).max(4000),
    sessionId: z.string().uuid(),
    metadata: z.any().optional(),
  });

const createClearSessionSchema = () =>
  z.object({
    sessionId: z.string().uuid(),
  });

export class AIController {
  private async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `ai:requests:${userId}:${today}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 86400); // 24 hours in seconds
    }

    const allowed = current <= 30;
    const remaining = Math.max(0, 30 - current);
    return { allowed, remaining };
  }

  // Stream chat endpoint using Server-Sent Events (SSE)
  async streamChat(req: Request, res: Response): Promise<void> {
    try {
      const chatRequestSchema = createChatRequestSchema();
      const validation = chatRequestSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        });
        return;
      }

      const { message, sessionId, metadata } = validation.data;
      const userId = req.auth()?.userId; // From Clerk middleware

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Check rate limit
      const rateLimit = await this.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        res.setHeader('X-RateLimit-Limit', '30');
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
        res.setHeader(
          'X-RateLimit-Reset',
          new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        );
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'You have exceeded the daily limit of 30 requests. Please try again tomorrow.',
          limit: 30,
          remaining: rateLimit.remaining,
          reset: 'Resets daily after 24 hour of your first message',
        });
        return;
      }

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      try {
        // Stream the response
        for await (const chunk of aiService.streamChat(
          message,
          sessionId,
          userId,
          metadata,
          // @ts-ignore
          req.signal,
        )) {
          // Send chunk as SSE event
          res.write(
            `data: ${JSON.stringify({
              type: 'chunk',
              content: chunk,
            })}\n\n`,
          );
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      } catch (streamError) {
        logger.error('Error during streaming:', streamError);
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            error: 'An error occurred during streaming',
          })}\n\n`,
        );
        res.end();
      }
    } catch (error) {
      logger.error('Error in streamChat controller:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  // Non-streaming chat endpoint (fallback)
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const chatRequestSchema = createChatRequestSchema();
      const validation = chatRequestSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        });
        return;
      }

      const { message, sessionId, metadata } = validation.data;
      const userId = req.auth()?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Check rate limit
      const rateLimit = await this.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        res.setHeader('X-RateLimit-Limit', '30');
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
        res.setHeader(
          'X-RateLimit-Reset',
          new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        );
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'You have exceeded the daily limit of 30 requests. Please try again tomorrow.',
          limit: 30,
          remaining: rateLimit.remaining,
          reset: 'Resets daily at midnight UTC',
        });
        return;
      }

      const response = await aiService.chat(message, sessionId, userId, metadata);

      res.json({
        success: true,
        data: {
          response,
          sessionId,
        },
      });
    } catch (error) {
      logger.error('Error in chat controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Clear session
  async clearSession(req: Request, res: Response): Promise<void> {
    try {
      const clearSessionSchema = createClearSessionSchema();
      const validation = clearSessionSchema.safeParse(req.params);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        });
        return;
      }

      const { sessionId } = validation.data;

      aiService.clearSession(sessionId);

      res.json({
        success: true,
        message: 'Session cleared successfully',
      });
    } catch (error) {
      logger.error('Error clearing session:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export const aiController = new AIController();
