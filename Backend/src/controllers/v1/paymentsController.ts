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

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { razorpay } from '../../config/razorpay.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getCachedUserInfo } from '../../utils/userCache.js';

interface RazorpayOrderOptions {
  amount: number;
  currency: string;
  receipt: string;
  notes: {
    userId: string;
    planId: string;
    planName: string;
    credits: number;
    userEmail: string;
    receipt: string;
  };
}

// Validation schemas
const createOrderSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
});

// Create Razorpay order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (ENV.PAYMENTS_ENABLED === false) {
      return res.status(403).json({
        success: false,
        message: 'Payments are currently disabled. Please try again later.',
      });
    }

    const userInfo = await getCachedUserInfo(userId);
    const userEmail = userInfo?.email || null;

    // Check if Razorpay is configured
    if (!razorpay) {
      logger.error('Razorpay not configured', { userId });
      return res.status(500).json({
        success: false,
        message: 'Payment service not configured',
      });
    }

    // Validate request body
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid create order request', {
        userId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.issues,
      });
    }

    const { planId } = validation.data;

    // Fetch plan from database
    const readOnlyPrisma = await getReadOnlyPrisma();
    const plan = await readOnlyPrisma.plan.findUnique({
      where: { planId, isActive: true },
    });

    if (!plan) {
      logger.warn('Invalid plan requested', { userId, planId });
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID',
      });
    }

    // Check for custom pricing plans
    if (plan.amount === 0) {
      logger.warn('Custom pricing plan requested', { userId, planId });
      return res.status(400).json({
        success: false,
        message: 'Custom pricing plans require manual processing',
      });
    }

    const planData = {
      id: plan.planId,
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      credits: plan.credits,
    };

    // Additional security: Log payment attempt for fraud monitoring
    logger.info('Payment order creation attempt', {
      userId,
      userEmail,
      planId,
      planName: plan.name,
      amount: plan.amount,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    const orderOptions: RazorpayOrderOptions = {
      amount: planData.amount,
      currency: planData.currency,
      receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString().slice(-6)}`, // Keep under 40 chars (Razorpay limit)
      notes: {
        userId, // Full userId stored in notes for verification (not affected by receipt truncation)
        planId: planData.id,
        planName: planData.name,
        credits: planData.credits,
        userEmail: userEmail || 'unknown',
        receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString().slice(-6)}`, // Store full receipt for reference
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    // Create payment record synchronously to prevent race conditions with verifyPayment.
    // This ensures that when the frontend immediately calls verifyPayment, the record exists.
    // Only fall back to Inngest async creation if the sync write fails.
    let syncRecordCreated = false;
    try {
      await prisma.payment.create({
        data: {
          userId,
          razorpayOrderId: order.id,
          planId: planData.id,
          planName: planData.name,
          amount: planData.amount,
          currency: planData.currency,
          credits: planData.credits,
          status: 'PENDING',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          notes: { ...orderOptions.notes },
          receipt: orderOptions.receipt,
          idempotencyKey: `order_${order.id}`,
          webhookProcessed: false,
        },
      });
      syncRecordCreated = true;
    } catch (dbError) {
      // Log but don't fail the request — Inngest fallback below will attempt to create it
      logger.error('Failed to create initial payment record in controller', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        userId,
        orderId: order.id,
      });
    }

    // Only dispatch Inngest fallback if the synchronous write failed.
    // Avoids a wasted idempotent Inngest invocation on every successful order.
    if (!syncRecordCreated) {
      await inngest.send({
        name: 'payment/order.created',
        data: {
          userId,
          userEmail: userEmail || null,
          orderId: order.id,
          planId: planData.id,
          planName: planData.name,
          amount: planData.amount,
          currency: planData.currency,
          credits: planData.credits,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          notes: orderOptions.notes,
          receipt: orderOptions.receipt,
        },
      });

      logger.warn('Payment record creation fell back to Inngest async handler', {
        userId,
        orderId: order.id,
      });
    }

    logger.info('Razorpay order created and payment record initialized', {
      userId,
      planId,
      orderId: order.id,
      amount: planData.amount,
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: ENV.RAZORPAY_KEY_ID, // Public key for frontend
      },
      plan: {
        id: planData.id,
        name: planData.name,
        description: plan.description,
        credits: planData.credits,
      },
      // Include server-calculated amount for additional client-side validation
      serverAmount: planData.amount,
      serverCurrency: planData.currency,
    });
  } catch (error) {
    logger.error('Create order error', {
      error: error instanceof Error ? error.message : String(error),
      errorCause: error instanceof Error && 'cause' in error ? error.cause : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.userId,
      planId: req.body?.planId,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
    });
  }
};

// Verify payment and award credits
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Block verification if payments are disabled mid-flow
    if (ENV.PAYMENTS_ENABLED === false) {
      return res.status(403).json({
        success: false,
        message: 'Payments are currently disabled. Please try again later.',
      });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      logger.error('Razorpay not configured', { userId });
      return res.status(500).json({
        success: false,
        message: 'Payment service not configured',
      });
    }

    // Guard: Ensure key secret is available (fail fast instead of runtime crash)
    if (!ENV.RAZORPAY_KEY_SECRET) {
      logger.error('RAZORPAY_KEY_SECRET is not configured', { userId });
      return res.status(500).json({
        success: false,
        message: 'Payment service misconfigured',
      });
    }

    // Validate request body
    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Invalid payment verification request', {
        userId,
        errors: validation.error.issues,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.issues,
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = validation.data;

    // Verify payment signature using timing-safe comparison to prevent timing attacks
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = createHmac('sha256', ENV.RAZORPAY_KEY_SECRET).update(sign).digest('hex');

    const sigBuffer = Buffer.from(razorpay_signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSign, 'utf8');
    const signatureValid =
      sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      logger.warn('Payment signature verification failed', {
        userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    const order = await razorpay.orders.fetch(razorpay_order_id);

    // SECURITY: Verify that the order belongs to the current user
    const orderUserId = order.notes?.userId;
    if (orderUserId && orderUserId !== userId) {
      logger.error('Security alert: Payment verification attempted for another user order', {
        attemptedBy: userId,
        orderOwner: orderUserId,
        orderId: razorpay_order_id,
      });
      return res.status(403).json({
        success: false,
        message: 'Unauthorized payment verification',
      });
    }

    // Extract plan details from order notes
    const planId = order.notes?.planId;
    const credits = order.notes?.credits;

    if (!planId) {
      logger.error('Plan ID not found in order notes', {
        userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid order data',
      });
    }

    // Fetch plan from database
    const plan = await prisma.plan.findUnique({
      where: { planId: String(planId) },
    });
    if (!plan) {
      logger.error('Plan not found', {
        userId,
        planId,
        orderId: razorpay_order_id,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid plan',
      });
    }

    // Additional security: Verify that the order amount matches the plan amount
    // Use Number() coercion since Razorpay SDK may return amount as string
    if (Number(order.amount) !== Number(plan.amount)) {
      logger.error('Order amount mismatch detected', {
        userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        orderAmount: order.amount,
        expectedAmount: plan.amount,
        planId,
      });
      return res.status(400).json({
        success: false,
        message: 'Payment amount verification failed',
      });
    }

    // SECURITY: Do NOT award credits here - only mark as verified
    // Credits will be awarded ONLY via webhook to prevent frontend manipulation

    // Update payment record to VERIFIED status (not COMPLETED)
    // Use upsert as a safety measure in case createOrder's sync creation failed and Inngest is slow
    await prisma.payment.upsert({
      where: { razorpayOrderId: razorpay_order_id },
      create: {
        userId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        planId: String(planId),
        planName: plan.name,
        amount: Number(order.amount),
        currency: order.currency,
        credits: Number(credits) || plan.credits,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        notes: order.notes as typeof order.notes,
        idempotencyKey: `order_${razorpay_order_id}`,
      },
      update: {
        status: 'VERIFIED',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        verifiedAt: new Date(),
      },
    });

    logger.info('Payment signature verified - awaiting webhook confirmation', {
      userId,
      planId: plan.planId,
      planName: plan.name,
      amount: order.amount,
      credits: Number(credits) || plan.credits,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      securityNote: 'Credits will be awarded only after webhook confirmation',
    });

    res.json({
      success: true,
      message: 'Payment verified. Awaiting confirmation to award credits.',
      status: 'VERIFIED',
      awaitingWebhook: true,
      data: {
        planId,
        planName: plan.name,
        credits: credits || plan.credits,
        amount: Number(order.amount), // Send raw amount in paise (Frontend divides by 100)
        currency: order.currency,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      },
    });
  } catch (error) {
    logger.error('Payment verification error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
};

// Razorpay webhook handler (for production scalability)
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // Check if Razorpay is configured
    if (!razorpay) {
      logger.error('Razorpay not configured for webhook');
      return res.status(500).json({ success: false, message: 'Payment service not configured' });
    }
    const secret = ENV.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Razorpay webhook secret not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Verify webhook signature using the raw request body bytes.
    // We MUST use the exact raw bytes — JSON.stringify(req.body) may reorder keys
    // or alter whitespace, causing signature mismatch. Fail hard if rawBody is missing
    // (this means the webhook route was not registered before express.json() middleware).
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.error(
        'Payment webhook: rawBody missing — ensure route is registered before express.json()',
      );
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }
    const bodyToSign = rawBody;

    const expectedSignature = createHmac('sha256', secret).update(bodyToSign).digest('hex');

    const razorpaySignature = req.headers['x-razorpay-signature'] as string;

    // Use timingSafeEqual to prevent timing attacks
    const sourceBuffer = Buffer.from(razorpaySignature || '');
    const targetBuffer = Buffer.from(expectedSignature);
    const isValid =
      razorpaySignature &&
      sourceBuffer.length === targetBuffer.length &&
      timingSafeEqual(sourceBuffer, targetBuffer);

    if (!isValid) {
      // SECURITY: Never log expectedSignature — if logs are compromised,
      // attackers could use it to forge webhook calls.
      logger.warn('Invalid webhook signature', {
        hasReceivedSignature: !!razorpaySignature,
        receivedSignaturePrefix: razorpaySignature?.slice(0, 8) + '...',
      });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const eventType = req.body.event;
    const eventId = req.body.id || `evt_${Date.now()}`;

    logger.info('Razorpay webhook received', {
      eventId,
      event: eventType,
      routedTo: eventType.startsWith('subscription.') ? 'subscription-webhook' : 'payment-webhook',
    });

    // Send webhook to Inngest for async processing
    // Route subscription events to subscription webhook handler
    const topic = eventType.startsWith('subscription.')
      ? 'subscription/webhook.received'
      : 'payment/webhook.received';

    await inngest.send({
      name: topic,
      data: {
        eventId,
        eventType,
        payload: req.body,
        signature: razorpaySignature,
      },
    });

    logger.info('Webhook event queued for processing', {
      eventId,
      eventType,
    });

    // Always respond quickly to webhook to prevent retries
    res.json({ success: true, message: 'Webhook received and queued for processing' });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
