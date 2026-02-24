/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Router } from 'express';
import {
  cancelSubscription,
  createSubscription,
  getCurrentSubscription,
  getSubscriptionHistory,
  getSubscriptionPlans,
  handleSubscriptionWebhook,
  verifySubscription,
} from '../../controllers/v1/subscriptionController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/subscriptions/plans:
 *   get:
 *     summary: Get all subscription plans
 *     description: Retrieve all active subscription plans (public endpoint)
 *     tags: [Subscriptions]
 *     security: []
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 */
router.get('/plans', getSubscriptionPlans);

/**
 * @swagger
 * /api/v1/subscriptions/current:
 *   get:
 *     summary: Get current user subscription
 *     description: Get the authenticated user's current active subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Subscription retrieved successfully
 */
router.get('/current', protectRoute, getCurrentSubscription);

/**
 * @swagger
 * /api/v1/subscriptions/history:
 *   get:
 *     summary: Get subscription history
 *     description: Get the authenticated user's subscription history
 *     tags: [Subscriptions]
 *     security:
 *       - ClerkAuth: []
 */
router.get('/history', protectRoute, getSubscriptionHistory);

/**
 * @swagger
 * /api/v1/subscriptions/create:
 *   post:
 *     summary: Create a subscription
 *     description: Create a new Razorpay subscription for the authenticated user
 *     tags: [Subscriptions]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 default: 1
 */
router.post('/create', protectRoute, createSubscription);

/**
 * @swagger
 * /api/v1/subscriptions/verify:
 *   post:
 *     summary: Verify subscription authentication
 *     description: Verify the Razorpay subscription signature after user authentication
 *     tags: [Subscriptions]
 *     security:
 *       - ClerkAuth: []
 */
router.post('/verify', protectRoute, verifySubscription);

/**
 * @swagger
 * /api/v1/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription
 *     description: Cancel the authenticated user's active subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ClerkAuth: []
 */
router.post('/cancel', protectRoute, cancelSubscription);

/**
 * @swagger
 * /api/v1/subscriptions/webhook:
 *   post:
 *     summary: Subscription webhook
 *     description: Razorpay webhook endpoint for subscription events
 *     tags: [Subscriptions]
 *     security: []
 */
router.post('/webhook', handleSubscriptionWebhook);

export default router;
