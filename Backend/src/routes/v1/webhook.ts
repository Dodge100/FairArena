import express, { Router } from 'express';
import { ENV } from '../../config/env.js';
import { handleGitHubWebhook } from '../../controllers/v1/webhookController.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * @swagger
 * /webhooks/v1/github/deploy:
 *   post:
 *     summary: GitHub webhook handler for deployment
 *     description: |
 *       Webhook endpoint for GitHub push events to trigger deployment.
 *       Only processes pushes to the main branch of the configured repository.
 *       Requires GitHub signature verification.
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - name: x-github-event
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub event type (must be 'push')
 *       - name: x-github-delivery
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub delivery ID
 *       - name: x-hub-signature-256
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ref:
 *                 type: string
 *                 description: Git reference (e.g., refs/heads/main)
 *               repository:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   full_name:
 *                     type: string
 *               commits:
 *                 type: array
 *                 items:
 *                   type: object
 *             required: [ref, repository, commits]
 *     responses:
 *       200:
 *         description: Deployment triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Deployment triggered successfully"
 *                 repository:
 *                   type: string
 *                   example: "FairArena/FairArena"
 *                 commits:
 *                   type: integer
 *                   example: 3
 *       400:
 *         description: Invalid webhook signature, payload, or unsupported event/branch
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
  '/github/deploy',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Missing GitHub signature' });
      }

      if (!event) {
        return res.status(400).json({ error: 'Missing GitHub event type' });
      }

      // Store raw body for verification
      const rawBody = req.body;

      // Verify GitHub webhook signature
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', ENV.GITHUB_WEBHOOK_SECRET);
      hmac.update(rawBody);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.error('GitHub webhook signature verification failed');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      // Parse the JSON payload
      req.body = JSON.parse(rawBody.toString());
      (req as any).rawBody = rawBody;
      (req as any).githubEvent = event;
      next();
    } catch (error) {
      logger.error('GitHub webhook verification failed:', { error });
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  },
  handleGitHubWebhook,
);

export default router;
