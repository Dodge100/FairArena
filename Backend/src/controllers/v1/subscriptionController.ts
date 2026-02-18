import crypto, { createHmac } from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { razorpay } from '../../config/razorpay.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis } from '../../config/redis.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { getUserSubscription, invalidateSubscriptionCache } from '../../utils/subscriptionUtils.js';

const PLANS_CACHE_KEY = 'subscription:plans:all';
const CACHE_TTL = 3600; // 1 hour

interface RazorpayInstance {
  subscriptions: {
    create: (params: Record<string, unknown>) => Promise<{ id: string; [key: string]: unknown }>;
    cancel: (subscriptionId: string, cancelAtCycleEnd: boolean) => Promise<unknown>;
    fetch: (
      subscriptionId: string,
    ) => Promise<{ id: string; status: string; paid_count: number; [key: string]: unknown }>;
  };
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  quantity: z.number().int().min(1).max(100).optional().default(1),
});

const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().optional().default(true),
  reason: z.string().max(500).optional(),
});

// ─── Get All Subscription Plans (public) ─────────────────────────────────────

export const getSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    // Try cache
    const cached = await redis.get(PLANS_CACHE_KEY);
    if (cached) {
      const plans = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, plans, cached: true });
    }

    const readOnlyPrisma = await getReadOnlyPrisma();
    const plans = await readOnlyPrisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { amount: 'asc' }],
      select: {
        id: true,
        planId: true,
        razorpayPlanId: true,
        name: true,
        tier: true,
        billingCycle: true,
        amount: true,
        currency: true,
        description: true,
        features: true,
        limits: true,
        isPopular: true,
        sortOrder: true,
      },
    });

    await redis.setex(PLANS_CACHE_KEY, CACHE_TTL, JSON.stringify(plans));

    return res.json({ success: true, plans, cached: false });
  } catch (error) {
    logger.error('Failed to fetch subscription plans', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Failed to fetch subscription plans' });
  }
};

// ─── Get Current User Subscription ───────────────────────────────────────────

export const getCurrentSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let subscription = await getUserSubscription(userId);

    // ── Self-Healing: Fix stuck AUTHENTICATED state ──────────────────────────
    // If a subscription is stuck in AUTHENTICATED (Pending Activation) for > 15s,
    // usage limits are still blocked. We cross-check with Razorpay to see if it's
    // actually ACTIVE (e.g. if we missed the webhook or it arrived out of order).
    if (subscription?.status === 'AUTHENTICATED' && subscription.razorpaySubscriptionId) {
      try {
        const rawSub = await prisma.subscription.findUnique({
          where: { id: subscription.subscriptionId },
          select: { updatedAt: true },
        });

        // Only check if it's been pending for more than 15 seconds
        if (rawSub && Date.now() - rawSub.updatedAt.getTime() > 15000) {
          const rzpSub = (await (razorpay as unknown as RazorpayInstance).subscriptions.fetch(
            subscription.razorpaySubscriptionId,
          )) as { status: string; current_start?: number; current_end?: number };

          if (rzpSub.status === 'active') {
            const currentStart = rzpSub.current_start
              ? new Date(Number(rzpSub.current_start) * 1000)
              : new Date();
            const currentEnd = rzpSub.current_end
              ? new Date(Number(rzpSub.current_end) * 1000)
              : null;

            await prisma.subscription.update({
              where: { id: subscription.subscriptionId },
              data: {
                status: 'ACTIVE',
                currentPeriodStart: currentStart,
                currentPeriodEnd: currentEnd,
                lastWebhookAt: new Date(),
              },
            });

            await invalidateSubscriptionCache(userId);
            // Refresh local variable to return the corrected ACTIVE status immediately
            subscription = await getUserSubscription(userId);

            logger.info('Self-healed stuck subscription (AUTHENTICATED → ACTIVE)', {
              userId,
              subscriptionId: subscription?.subscriptionId,
            });
          }
        }
      } catch (err) {
        logger.warn('Failed to self-heal stuck subscription', {
          userId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return res.json({
      success: true,
      data: {
        subscription,
        tier: subscription?.tier ?? 'FREE',
        isActive: !!subscription,
      },
    });
  } catch (error) {
    logger.error('Failed to get current subscription', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to get subscription' });
  }
};

// ─── Create Subscription ─────────────────────────────────────────────────────

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Payment service not configured' });
    }

    if (ENV.PAYMENTS_ENABLED === false) {
      return res.status(403).json({
        success: false,
        message: 'Payments are currently disabled.',
      });
    }

    const validation = createSubscriptionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.issues,
      });
    }

    const { planId, quantity } = validation.data;

    // Check for existing active or pending subscription
    const existingSub = await getUserSubscription(userId);
    const actionFlags: Record<string, boolean> = {};

    // Block if a payment is already in flight (AUTHENTICATED = payment made, waiting for webhook).
    // getUserSubscription returns AUTHENTICATED subs with tier='FREE' (no benefits yet), so we
    // must check status directly — not tier — to catch this case.
    if (existingSub?.status === 'AUTHENTICATED') {
      return res.status(409).json({
        success: false,
        message:
          'A payment is already being processed for your account. Please wait for it to activate before subscribing again.',
      });
    }

    // Handle existing ACTIVE subscription — allow plan switching
    if (existingSub && existingSub.tier !== 'FREE') {
      // Fetch any pending subscriptions to clean up
      const queuedSub = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['CREATED', 'AUTHENTICATED'] },
          id: { not: existingSub.subscriptionId },
        },
      });

      // Defer cancellation to verifySubscription — if new payment fails, user keeps existing plan.
      actionFlags.shouldCancelActive = true;

      // If there are any pending subscriptions, mark them for cancellation too
      if (queuedSub) {
        actionFlags.shouldCancelQueued = true;
      }
    }

    // Fetch plan
    const readOnlyPrisma = await getReadOnlyPrisma();
    const plan = await readOnlyPrisma.subscriptionPlan.findUnique({
      where: { planId, isActive: true },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }

    if (!plan.razorpayPlanId) {
      return res.status(400).json({
        success: false,
        message: 'This plan is not yet available for subscription. Please contact support.',
      });
    }

    // Fetch user info for Razorpay
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { email: true, firstName: true, lastName: true, phoneNumber: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Create Razorpay subscription
    // total_count: Monthly = 120 cycles (10 years), Yearly = 10 cycles (10 years).
    const totalCount = plan.billingCycle === 'YEARLY' ? 10 : 120;

    const subscriptionData: Record<string, unknown> = {
      plan_id: plan.razorpayPlanId,
      total_count: totalCount,
      quantity,
      customer_notify: 1,
      // If it's a trial, we might want an upfront auth amount to verify card (Razorpay standard is usually auto-auth)
      // We don't need 'addons' for 1 rupee if we trust the mandate setup flow.
      notes: {
        userId,
        planId: plan.planId,
        planName: plan.name,
        tier: plan.tier,
        billingCycle: plan.billingCycle,
        userEmail: user.email,
        contact: user.phoneNumber,
      },
    };

    const razorpaySubscription = await (
      razorpay as unknown as RazorpayInstance
    ).subscriptions.create(subscriptionData);

    // Create subscription record in DB
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.planId,
        razorpaySubscriptionId: razorpaySubscription.id,
        status: 'CREATED', // Will become AUTHENTICATED after payment
        quantity,
        metadata: {
          razorpayPlanId: plan.razorpayPlanId,
          createdVia: 'api',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          ...actionFlags,
        },
      },
    });

    await invalidateSubscriptionCache(userId);

    logger.info('Subscription created', {
      userId,
      subscriptionId: subscription.id,
      razorpaySubscriptionId: razorpaySubscription.id,
      planId: plan.planId,
      tier: plan.tier,
    });

    return res.json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscriptionId: subscription.id,
        razorpaySubscriptionId: razorpaySubscription.id,
        razorpayKeyId: ENV.RAZORPAY_KEY_ID,
        plan: {
          id: plan.planId,
          name: plan.name,
          tier: plan.tier,
          amount: plan.amount,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
        },
        userInfo: {
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User',
          email: user.email,
          contact: user.phoneNumber || '',
        },
      },
    });
  } catch (error) {
    logger.error('Failed to create subscription', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to create subscription' });
  }
};

// ─── Verify Subscription Authentication ──────────────────────────────────────

export const verifySubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Payment service not configured' });
    }

    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ── Layer 1: HMAC Signature Verification ──────────────────────────────────
    // Verify the signature is genuinely from Razorpay using our secret key.
    // This prevents any client-side forgery of payment IDs.
    const sign = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSign = createHmac('sha256', ENV.RAZORPAY_KEY_SECRET!).update(sign).digest('hex');

    if (razorpay_signature !== expectedSign) {
      logger.warn('Subscription signature verification failed', {
        userId,
        razorpay_subscription_id,
      });
      return res
        .status(400)
        .json({ success: false, message: 'Payment signature verification failed' });
    }

    // ── Layer 2: Razorpay API Cross-Verification ───────────────────────────────
    // Fetch the subscription from Razorpay's servers to confirm it exists and
    // is NOT in a terminal/invalid state (cancelled, expired, completed).
    //
    // IMPORTANT: We do NOT check paid_count or require status='authenticated' here.
    // Reason: The browser calls /verify immediately after Razorpay's checkout handler
    // fires — at that moment the subscription status on Razorpay is still 'created'
    // and paid_count=0 because the subscription.authenticated/activated webhooks
    // arrive asynchronously (seconds later). The HMAC signature already proves the
    // payment happened — it is cryptographically signed by Razorpay's servers using
    // our shared secret and cannot be forged.
    let rzpSubscription: { status: string; paid_count: number; [key: string]: unknown };
    try {
      rzpSubscription = await (razorpay as unknown as RazorpayInstance).subscriptions.fetch(
        razorpay_subscription_id,
      );
    } catch (rzpErr) {
      logger.error('Failed to fetch subscription from Razorpay for verification', {
        userId,
        razorpay_subscription_id,
        error: rzpErr,
      });
      return res.status(400).json({
        success: false,
        message: 'Could not verify payment with Razorpay. Please contact support.',
      });
    }

    const rzpStatus = rzpSubscription.status;

    // Only reject if the subscription is in a terminal state that means the
    // payment genuinely did not go through or the subscription is dead.
    const rzpRejectedStatuses = ['cancelled', 'expired', 'completed'];
    if (rzpRejectedStatuses.includes(rzpStatus)) {
      logger.warn('Razorpay subscription in terminal state during verification — rejecting', {
        userId,
        razorpay_subscription_id,
        rzpStatus,
      });
      return res.status(400).json({
        success: false,
        message: `Subscription is no longer valid (${rzpStatus}). Please start a new subscription.`,
      });
    }

    // ── Layer 3: DB Ownership Check ───────────────────────────────────────────
    // Ensure this subscription belongs to the authenticated user in our DB.
    // Prevents one user from verifying another user's subscription.
    const subscription = await prisma.subscription.findFirst({
      where: { razorpaySubscriptionId: razorpay_subscription_id, userId },
    });

    if (!subscription) {
      logger.warn('Subscription not found or ownership mismatch during verification', {
        userId,
        razorpay_subscription_id,
      });
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // All 3 layers passed — mark as AUTHENTICATED in DB.
    // The subscription.activated webhook will set it to ACTIVE shortly after.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'AUTHENTICATED' },
    });

    await invalidateSubscriptionCache(userId);

    logger.info('Subscription verified (3-layer check passed)', {
      userId,
      subscriptionId: subscription.id,
      razorpay_subscription_id,
      rzpStatus,
      paidCount: rzpSubscription.paid_count,
    });

    // ── Process Action Flags ───────────────────────────────────────────────────
    // These were set at subscription creation time to handle plan switching.
    // We cancel old subscriptions AFTER verifying the new payment — so if payment
    // fails, the user keeps their existing plan.
    const metadata = (subscription.metadata as Record<string, unknown>) || {};

    if (metadata.shouldCancelActive) {
      const activeSubs = await prisma.subscription.findMany({
        where: { userId, status: 'ACTIVE', id: { not: subscription.id } },
      });

      for (const sub of activeSubs) {
        if (sub.razorpaySubscriptionId) {
          try {
            // Fetch current state first — might already be cancelled
            const rzpOldSub = await (razorpay as unknown as RazorpayInstance).subscriptions.fetch(
              sub.razorpaySubscriptionId,
            );
            if (!rzpRejectedStatuses.includes(rzpOldSub.status)) {
              await (razorpay as unknown as RazorpayInstance).subscriptions.cancel(
                sub.razorpaySubscriptionId,
                false, // immediate
              );
            }
          } catch (e) {
            logger.warn('Failed to cancel old active subscription during plan switch', {
              error: e,
            });
          }
        }
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        logger.info('Old active subscription cancelled due to plan switch', {
          userId,
          cancelledSubId: sub.id,
        });
      }
    }

    if (metadata.shouldCancelQueued) {
      const pendingSubs = await prisma.subscription.findMany({
        where: {
          userId,
          status: { in: ['CREATED', 'AUTHENTICATED'] },
          id: { not: subscription.id },
        },
      });

      for (const sub of pendingSubs) {
        if (sub.razorpaySubscriptionId) {
          try {
            await (razorpay as unknown as RazorpayInstance).subscriptions.cancel(
              sub.razorpaySubscriptionId,
              false,
            );
          } catch (e) {
            logger.warn('Failed to cancel pending subscription during verification', { error: e });
          }
        }
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      }
    }

    return res.json({
      success: true,
      message:
        'Payment verified. Your plan is activating — benefits will be available within 1–2 minutes.',
      data: {
        status: 'AUTHENTICATED',
        razorpayStatus: rzpStatus,
      },
    });
  } catch (error) {
    logger.error('Failed to verify subscription', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to verify subscription' });
  }
};

// ─── Cancel Subscription ──────────────────────────────────────────────────────

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const validation = cancelSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }

    const { cancelAtPeriodEnd, reason } = validation.data;

    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'AUTHENTICATED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }

    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Payment service not configured' });
    }

    // Cancel on Razorpay
    if (subscription.razorpaySubscriptionId) {
      // For cancellations, check Razorpay state first to avoid redundant calls
      let rzpCurrentStatus: string | null = null;
      try {
        const rzpSub = await (razorpay as unknown as RazorpayInstance).subscriptions.fetch(
          subscription.razorpaySubscriptionId,
        );
        rzpCurrentStatus = rzpSub.status;
      } catch {
        logger.warn('Could not fetch Razorpay subscription state before cancel', {
          userId,
          subscriptionId: subscription.id,
        });
      }

      // Terminal states on Razorpay — no point calling cancel again
      const rzpTerminalStates = ['cancelled', 'completed', 'expired'];
      const alreadyTerminal = rzpCurrentStatus && rzpTerminalStates.includes(rzpCurrentStatus);

      // User Logic: If the user previously cancelled at period end, the subscription on Razorpay
      // is already set to stop renewing. If they now want to "Revoke Access Immediately",
      // we do NOT need to call Razorpay again (it might error or be redundant).
      // We just update our local DB to cut off access immediately.
      if (subscription.cancelAtPeriodEnd) {
        logger.info(
          'Skipping Razorpay cancel call — subscription already scheduled to cancel. Proceeding to revoke DB access immediately.',
          {
            userId,
            subscriptionId: subscription.id,
          },
        );
      } else if (alreadyTerminal) {
        logger.info('Skipping Razorpay cancel call — subscription already in terminal state', {
          userId,
          subscriptionId: subscription.id,
          rzpCurrentStatus,
        });
      } else {
        // Always attempt to cancel on Razorpay for fresh cancellations.
        // If Razorpay rejects it, our error handler below will catch it.
        try {
          await (razorpay as unknown as RazorpayInstance).subscriptions.cancel(
            subscription.razorpaySubscriptionId,
            cancelAtPeriodEnd,
          );
        } catch (error: unknown) {
          const rzpError = error as { error?: { description?: string }; message?: string };
          const errorDescription = (
            rzpError?.error?.description ||
            rzpError?.message ||
            ''
          ).toLowerCase();
          const isAlreadyDone =
            errorDescription.includes('completed') ||
            errorDescription.includes('cancelled') ||
            errorDescription.includes('already') ||
            errorDescription.includes('halted');

          if (isAlreadyDone) {
            logger.warn(
              'Subscription already in a terminal state on Razorpay — proceeding with DB update',
              {
                userId,
                subscriptionId: subscription.id,
                razorpayError: errorDescription,
              },
            );
            // Fall through — DB update below will revoke access
          } else {
            logger.error('Razorpay subscription cancellation failed', {
              userId,
              subscriptionId: subscription.id,
              error: rzpError,
            });
            return res.status(500).json({
              success: false,
              message: 'Failed to cancel subscription with payment provider',
            });
          }
        }
      }
    }

    // Update DB
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd,
        cancelledAt: cancelAtPeriodEnd ? null : new Date(),
        cancelReason: reason,
        status: cancelAtPeriodEnd ? subscription.status : 'CANCELLED',
      },
    });

    await invalidateSubscriptionCache(userId);

    // Send notification
    try {
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          title: cancelAtPeriodEnd
            ? '📋 Subscription Cancellation Scheduled'
            : '❌ Subscription Cancelled',
          message: cancelAtPeriodEnd
            ? 'Your subscription will remain active until the end of the current billing period.'
            : 'Your subscription has been cancelled immediately.',
          actionUrl: '/dashboard/subscription',
          actionLabel: 'View Subscription',
          metadata: { type: 'subscription_cancelled', subscriptionId: subscription.id },
        },
      });
    } catch {}

    logger.info('Subscription cancelled', {
      userId,
      subscriptionId: subscription.id,
      cancelAtPeriodEnd,
    });

    return res.json({
      success: true,
      message: cancelAtPeriodEnd
        ? 'Subscription will be cancelled at the end of the billing period.'
        : 'Subscription cancelled immediately.',
    });
  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
};

// ─── Subscription Webhook ─────────────────────────────────────────────────────

export const handleSubscriptionWebhook = async (req: Request, res: Response) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Payment service not configured' });
    }

    const secret = ENV.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Razorpay webhook secret not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // Use the raw body buffer for HMAC — re-serializing parsed JSON changes byte
    // ordering/whitespace and will ALWAYS produce a signature mismatch.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.error(
        'Subscription webhook: rawBody missing — ensure route is registered before express.json()',
      );
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const razorpaySignature = req.headers['x-razorpay-signature'] as string;
    if (!razorpaySignature) {
      logger.warn('Subscription webhook: missing x-razorpay-signature header');
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpaySignature))) {
      logger.warn('Invalid subscription webhook signature', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body.event;
    const eventId = req.body.id || `sub_evt_${Date.now()}`;

    logger.info('Subscription webhook received', { eventId, event });

    // Queue for async processing
    await inngest.send({
      name: 'subscription/webhook.received',
      data: {
        eventId,
        eventType: event,
        payload: req.body,
        signature: razorpaySignature,
      },
    });

    return res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    logger.error('Subscription webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ─── Get Subscription History ─────────────────────────────────────────────────

export const getSubscriptionHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        plan: {
          select: {
            planId: true,
            name: true,
            tier: true,
            billingCycle: true,
            amount: true,
            currency: true,
          },
        },
      },
    });

    return res.json({ success: true, data: { subscriptions } });
  } catch (error) {
    logger.error('Failed to get subscription history', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to get subscription history' });
  }
};
