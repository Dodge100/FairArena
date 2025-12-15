import { Router } from 'express';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../../controllers/v1/newsletterController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/newsletter/subscribe:
 *   post:
 *     summary: Subscribe to newsletter
 *     description: Subscribe an email address to the FairArena newsletter
 *     tags: [Newsletter]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               name:
 *                 type: string
 *                 description: Subscriber name (optional)
 *     responses:
 *       200:
 *         description: Subscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully subscribed to newsletter"
 *       400:
 *         description: Email already subscribed or invalid
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/subscribe', subscribeToNewsletter);

/**
 * @swagger
 * /api/v1/newsletter/unsubscribe:
 *   post:
 *     summary: Unsubscribe from newsletter
 *     description: Unsubscribe an email address from the FairArena newsletter
 *     tags: [Newsletter]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *                 description: Unsubscribe token from email
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully unsubscribed from newsletter"
 *       400:
 *         description: Invalid email or token
 *       404:
 *         description: Email not found in newsletter list
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/unsubscribe', unsubscribeFromNewsletter);

export default router;
