import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Webhook } from 'svix';
import { ENV } from '../config/env.js';
import { handleClerkWebhook } from '../controllers/webhookController.js';

const router = Router();

// Rate limiting for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Clerk webhook endpoint
router.post('/clerk', webhookLimiter, async (req, res) => {
  try {
    const wh = new Webhook(ENV.CLERK_WEBHOOK_SECRET!);
    const payload = wh.verify(JSON.stringify(req.body), {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    }) as unknown;

    req.body = payload;
    await handleClerkWebhook(req, res);
  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

export default router;
