import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Webhook } from 'svix';
import { ENV } from '../../config/env.js';
import { handleClerkWebhook } from '../../controllers/v1/webhookController.js';

const router = Router();

// Rate limiter for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Clerk webhook endpoint
router.post(
  '/clerk',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const wh = new Webhook(ENV.CLERK_WEBHOOK_SECRET);
      const payload = wh.verify(req.body, {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      }) as unknown;

      // Replace body with verified parsed payload
      req.body = payload;
      next();
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  },
  handleClerkWebhook,
);

export default router;
