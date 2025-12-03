import { clerkClient } from '@clerk/express';
import { createHmac } from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { getPlanById, razorpay, validatePlan } from '../../config/razorpay.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

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
    const auth = req.auth();
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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

    // Validate plan
    const planValidation = validatePlan(planId);
    if (!planValidation.valid) {
      logger.warn('Invalid plan requested', { userId, planId, error: planValidation.error });
      return res.status(400).json({
        success: false,
        message: planValidation.error,
      });
    }

    const plan = planValidation.plan!;

    // Get user email from auth
    const clerkUser = await clerkClient.users.getUser(userId);
    const userEmail = clerkUser.primaryEmailAddress?.emailAddress;

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
      amount: plan.amount,
      currency: plan.currency,
      receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString().slice(-6)}`, // Keep under 40 chars (Razorpay limit)
      notes: {
        userId, // Full userId stored in notes for verification (not affected by receipt truncation)
        planId: plan.id,
        planName: plan.name,
        credits: plan.credits,
        userEmail: userEmail || 'unknown',
        receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString().slice(-6)}`, // Store full receipt for reference
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    // Send event to Inngest for async payment record creation
    await inngest.send({
      name: 'payment/order.created',
      data: {
        userId,
        userEmail: userEmail || null,
        orderId: order.id,
        planId: plan.id,
        planName: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        credits: plan.credits,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        notes: orderOptions.notes,
        receipt: orderOptions.receipt,
      },
    });

    logger.info('Razorpay order created', {
      userId,
      planId,
      orderId: order.id,
      amount: plan.amount,
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID, // Public key for frontend
      },
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        credits: plan.credits,
      },
      // Include server-calculated amount for additional client-side validation
      serverAmount: plan.amount,
      serverCurrency: plan.currency,
    });
  } catch (error) {
    logger.error('Create order error', {
      error: error instanceof Error ? error.message : JSON.stringify(error),
      userId: req.auth()?.userId,
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
    const auth = req.auth();
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      logger.error('Razorpay not configured', { userId });
      return res.status(500).json({
        success: false,
        message: 'Payment service not configured',
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

    // Verify payment signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
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

    // Fetch order details from Razorpay
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

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

    const plan = getPlanById(String(planId));
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
    if (order.amount !== plan.amount) {
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

    // Update payment record and award credits
    // Send verification event to Inngest for async processing
    await inngest.send({
      name: 'payment/verified',
      data: {
        userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        planId,
        planName: plan.name,
        amount: order.amount,
        credits: credits || plan.credits,
        paymentMethod: payment.method,
        paymentContact: payment.contact,
      },
    });

    logger.info('Payment verification initiated', {
      userId,
      planId,
      planName: plan.name,
      amount: order.amount,
      credits: credits || plan.credits,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      paymentStatus: payment.status,
    });

    res.json({
      success: true,
      message: 'Payment verification in progress. Credits will be awarded shortly.',
      data: {
        planId,
        planName: plan.name,
        credits: credits || plan.credits,
        amount: Number(order.amount) / 100,
        currency: order.currency,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      },
    });
  } catch (error) {
    logger.error('Payment verification error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.auth()?.userId,
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
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Razorpay webhook secret not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Verify webhook signature
    const expectedSignature = createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const razorpaySignature = req.headers['x-razorpay-signature'] as string;

    if (!razorpaySignature || expectedSignature !== razorpaySignature) {
      logger.warn('Invalid webhook signature', {
        receivedSignature: razorpaySignature,
        expectedSignature,
      });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body.event;
    const eventId = req.body.id || `evt_${Date.now()}`;

    logger.info('Razorpay webhook received', {
      eventId,
      event,
    });

    // Send webhook to Inngest for async processing
    await inngest.send({
      name: 'payment/webhook.received',
      data: {
        eventId: event,
        eventType: event,
        payload: req.body,
        signature: razorpaySignature,
      },
    });

    logger.info('Webhook event queued for processing', {
      eventId,
      eventType: event,
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
