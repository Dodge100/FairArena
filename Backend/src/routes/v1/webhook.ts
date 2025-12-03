import express, { Router } from 'express';
import { Webhook } from 'svix';
import { ENV } from '../../config/env.js';
import { handleClerkWebhook } from '../../controllers/v1/webhookController.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /webhooks/v1/clerk:
 *   post:
 *     summary: Clerk webhook handler
 *     description: |
 *       Webhook endpoint for Clerk authentication events (user.created, user.updated, user.deleted, etc.)
 *       Requires Svix signature verification headers.
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - name: svix-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: Svix message ID
 *       - name: svix-timestamp
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: Svix timestamp
 *       - name: svix-signature
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: Svix signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user.created, user.updated, user.deleted, session.created, session.ended]
 *               data:
 *                 type: object
 *                 description: Event data from Clerk
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid webhook signature"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/clerk',
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
      logger.error('Webhook signature verification failed:', error);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  },
  handleClerkWebhook,
);

export default router;
