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

import { prisma } from '../../config/database.js';
import { sendEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { invalidateSubscriptionCache } from '../../utils/subscriptionUtils.js';
import { inngest } from './client.js';

/**
 * Inngest function to process Razorpay subscription webhook events asynchronously.
 * Handles: subscription.activated, subscription.charged, subscription.cancelled,
 *          subscription.completed, subscription.halted, subscription.paused, subscription.resumed
 *
 * Security model:
 * - The webhook endpoint is registered BEFORE express.json() so the raw body bytes
 *   are preserved for HMAC-SHA256 signature verification.
 * - The signature is verified in the controller using crypto.timingSafeEqual().
 * - Only after verification does the controller fire this Inngest event.
 * - The frontend is NEVER trusted for subscription status — all state changes
 *   originate exclusively from Razorpay webhook events processed here.
 */
export const subscriptionWebhookReceived = inngest.createFunction(
  {
    id: 'subscription-webhook-received',
    name: 'Process Subscription Webhook',
    retries: 5,
    concurrency: { limit: 10 },
  },
  { event: 'subscription/webhook.received' },
  async ({ event, step }) => {
    const { eventId, eventType, payload, signature } = event.data;

    logger.info('Processing subscription webhook', { eventId, eventType });

    // Store webhook event record
    await step.run('store-webhook-event', async () => {
      const subscriptionData = payload?.payload?.subscription?.entity;
      const razorpaySubId = subscriptionData?.id;

      let subscriptionRecord = null;
      if (razorpaySubId) {
        subscriptionRecord = await prisma.subscription.findFirst({
          where: { razorpaySubscriptionId: razorpaySubId },
        });
      }

      await prisma.subscriptionWebhookEvent.create({
        data: {
          subscriptionId: subscriptionRecord?.id ?? null,
          razorpayEventId: eventId,
          eventType,
          payload,
          signature,
          processed: false,
        },
      });
    });

    // Process based on event type
    await step.run('process-event', async () => {
      const subscriptionEntity = payload?.payload?.subscription?.entity;
      if (!subscriptionEntity) {
        logger.warn('No subscription entity in webhook payload', { eventId, eventType });
        return;
      }

      const razorpaySubId = subscriptionEntity.id;
      const subscription = await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: razorpaySubId },
        include: {
          plan: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!subscription) {
        logger.warn('Subscription not found for webhook', { razorpaySubId, eventType });
        return;
      }

      const userId = subscription.userId;
      const userEmail = subscription.user.email;
      const firstName = subscription.user.firstName ?? 'there';
      const plan = subscription.plan;

      // Helper to send subscription emails without blocking the main flow
      const sendSubEmail = async (
        template: string,
        subject: string,
        templateData: Record<string, unknown>,
      ) => {
        try {
          await sendEmail({
            to: userEmail,
            subject,
            templateType: template as Parameters<typeof sendEmail>[0]['templateType'],
            templateData: templateData as Parameters<typeof sendEmail>[0]['templateData'],
          });
        } catch (err) {
          logger.error('Failed to send subscription email', { template, userEmail, err });
          // Never throw — email failure must not block subscription state updates
        }
      };

      // Status priority order — never allow a webhook to downgrade to a lower status.
      // Razorpay can fire webhooks out of order (e.g. subscription.authenticated arrives
      // AFTER subscription.activated). We use this map to guard against regressions.
      const STATUS_RANK: Record<string, number> = {
        CREATED: 0,
        AUTHENTICATED: 1,
        ACTIVE: 2,
        PAUSED: 2,
        HALTED: 2,
        CANCELLED: 3,
        COMPLETED: 3,
        EXPIRED: 3,
      };
      const currentRank = STATUS_RANK[subscription.status] ?? 0;

      switch (eventType) {
        case 'subscription.activated': {
          const currentStart = subscriptionEntity.current_start
            ? new Date(subscriptionEntity.current_start * 1000)
            : new Date();
          const currentEnd = subscriptionEntity.current_end
            ? new Date(subscriptionEntity.current_end * 1000)
            : null;

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: currentStart,
              currentPeriodEnd: currentEnd,
              webhookProcessed: true,
              lastWebhookAt: new Date(),
            },
          });

          await invalidateSubscriptionCache(userId);

          // Send activation email
          await sendSubEmail(
            'subscription-activated',
            `🎉 Your ${plan.name} subscription is now active — FairArena`,
            {
              firstName,
              planName: plan.name,
              tier: plan.tier,
              billingCycle: plan.billingCycle,
              amount: plan.amount,
              currency: plan.currency,
              currentPeriodEnd: currentEnd?.toISOString() ?? null,
              razorpaySubscriptionId: razorpaySubId,
              features: Array.isArray(plan.features) ? plan.features : [],
            },
          );

          // In-app notification
          try {
            await inngest.send({
              name: 'notification/send',
              data: {
                userId,
                title: `🎉 ${plan.name} Activated!`,
                message: `Your ${plan.name} subscription is now active. Enjoy all the premium features!`,
                actionUrl: '/dashboard/subscription',
                actionLabel: 'View Subscription',
                metadata: { type: 'subscription_activated', tier: plan.tier },
              },
            });
          } catch {}

          logger.info('Subscription activated', { userId, subscriptionId: subscription.id });
          break;
        }

        case 'subscription.authenticated': {
          // Only upgrade CREATED → AUTHENTICATED. Never downgrade from ACTIVE or higher.
          // Razorpay frequently fires this event AFTER subscription.activated — if we
          // blindly update, we overwrite ACTIVE back to AUTHENTICATED and the user's
          // plan appears stuck in "Pending Activation" forever.
          if (currentRank > STATUS_RANK['AUTHENTICATED']) {
            logger.info('Skipping subscription.authenticated — already at higher status', {
              userId,
              subscriptionId: subscription.id,
              currentStatus: subscription.status,
            });
            break;
          }
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'AUTHENTICATED',
              lastWebhookAt: new Date(),
            },
          });
          await invalidateSubscriptionCache(userId);
          logger.info('Subscription authenticated via webhook', {
            userId,
            subscriptionId: subscription.id,
          });
          break;
        }

        case 'subscription.charged': {
          const currentStart = subscriptionEntity.current_start
            ? new Date(subscriptionEntity.current_start * 1000)
            : new Date();
          const currentEnd = subscriptionEntity.current_end
            ? new Date(subscriptionEntity.current_end * 1000)
            : null;

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: currentStart,
              currentPeriodEnd: currentEnd,
              lastWebhookAt: new Date(),
            },
          });

          await invalidateSubscriptionCache(userId);

          // Send renewal email
          await sendSubEmail(
            'subscription-renewed',
            `✅ ${plan.name} subscription renewed — FairArena`,
            {
              firstName,
              planName: plan.name,
              tier: plan.tier,
              billingCycle: plan.billingCycle,
              amount: plan.amount,
              currency: plan.currency,
              currentPeriodStart: currentStart.toISOString(),
              currentPeriodEnd: currentEnd?.toISOString() ?? null,
              razorpaySubscriptionId: razorpaySubId,
            },
          );

          logger.info('Subscription charged (renewed)', {
            userId,
            subscriptionId: subscription.id,
          });
          break;
        }

        case 'subscription.cancelled': {
          // Determine if it was immediate or at period end
          const cancelledImmediately = !subscription.cancelAtPeriodEnd;

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              lastWebhookAt: new Date(),
            },
          });

          await invalidateSubscriptionCache(userId);

          // Send cancellation email
          await sendSubEmail(
            'subscription-cancelled',
            `📋 Your ${plan.name} subscription has been cancelled — FairArena`,
            {
              firstName,
              planName: plan.name,
              tier: plan.tier,
              billingCycle: plan.billingCycle,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
              cancelledImmediately,
            },
          );

          try {
            await inngest.send({
              name: 'notification/send',
              data: {
                userId,
                title: '📋 Subscription Cancelled',
                message: cancelledImmediately
                  ? 'Your subscription has been cancelled immediately.'
                  : `Your subscription has been cancelled. You retain access until ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN') : 'the end of your billing period'}.`,
                actionUrl: '/dashboard/subscription',
                actionLabel: 'Resubscribe',
                metadata: { type: 'subscription_cancelled' },
              },
            });
          } catch {}

          logger.info('Subscription cancelled via webhook', {
            userId,
            subscriptionId: subscription.id,
          });
          break;
        }

        case 'subscription.completed': {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'COMPLETED', lastWebhookAt: new Date() },
          });
          await invalidateSubscriptionCache(userId);

          // Treat completed like cancelled — the subscription ran its full term
          await sendSubEmail(
            'subscription-cancelled',
            `Your ${plan.name} subscription has completed — FairArena`,
            {
              firstName,
              planName: plan.name,
              tier: plan.tier,
              billingCycle: plan.billingCycle,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
              cancelledImmediately: false,
            },
          );

          logger.info('Subscription completed', { userId, subscriptionId: subscription.id });
          break;
        }

        case 'subscription.halted': {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'HALTED', lastWebhookAt: new Date() },
          });
          await invalidateSubscriptionCache(userId);

          // Send payment failed email
          await sendSubEmail(
            'subscription-payment-failed',
            `⚠️ Subscription payment failed — action required — FairArena`,
            {
              firstName,
              planName: plan.name,
              tier: plan.tier,
              billingCycle: plan.billingCycle,
              amount: plan.amount,
              currency: plan.currency,
              failureReason:
                'Multiple payment retry attempts failed. Your subscription has been halted.',
              razorpaySubscriptionId: razorpaySubId,
            },
          );

          try {
            await inngest.send({
              name: 'notification/send',
              data: {
                userId,
                title: '⚠️ Subscription Payment Failed',
                message:
                  'Your subscription has been halted due to a payment failure. Please update your payment method.',
                actionUrl: '/dashboard/subscription',
                actionLabel: 'Update Payment',
                metadata: { type: 'subscription_halted' },
              },
            });
          } catch {}

          logger.warn('Subscription halted', { userId, subscriptionId: subscription.id });
          break;
        }

        case 'subscription.paused': {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'PAUSED', lastWebhookAt: new Date() },
          });
          await invalidateSubscriptionCache(userId);
          logger.info('Subscription paused', { userId, subscriptionId: subscription.id });
          break;
        }

        case 'subscription.resumed': {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE', lastWebhookAt: new Date() },
          });
          await invalidateSubscriptionCache(userId);
          logger.info('Subscription resumed', { userId, subscriptionId: subscription.id });
          break;
        }

        default:
          logger.info('Unhandled subscription webhook event', { eventType, eventId });
      }

      // Mark webhook event as processed
      await prisma.subscriptionWebhookEvent.updateMany({
        where: { razorpayEventId: eventId },
        data: { processed: true, processedAt: new Date() },
      });
    });

    return { success: true, eventId, eventType };
  },
);
