import express, { Router } from 'express';
import { Webhook } from 'svix';
import { ENV } from '../../config/env.js';
import { handleClerkWebhook } from '../../controllers/v1/webhookController.js';

const router = Router();

// Clerk webhook endpoint
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      console.log('Raw body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
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
