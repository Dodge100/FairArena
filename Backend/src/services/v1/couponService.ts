import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { SubscriptionPlan } from '../../generated/client.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { addUserCredits } from './creditService.js';

/**
 * Hash a coupon code for secure storage and lookup
 */
export function hashCouponCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * Validate and redeem a coupon for a user
 */
export async function redeemCoupon(
  userId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const codeHash = hashCouponCode(code);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Find the coupon
        const coupon = await tx.coupon.findUnique({
          where: { codeHash },
        });

        if (!coupon || !coupon.isActive) {
          throw new Error('Invalid or inactive coupon code');
        }

        // 2. Check expiration
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new Error('Coupon has expired');
        }

        // 3. Check specific user lock
        if (coupon.userId && coupon.userId !== userId) {
          throw new Error('This coupon is not valid for your account');
        }

        // 4. Check global usage limit
        if (coupon.maxUsages !== null && coupon.usagesDone >= coupon.maxUsages) {
          throw new Error('Coupon usage limit reached');
        }

        // 5. Check per-user limit
        if (coupon.isOneTimePerUser) {
          const previousRedemption = await tx.couponRedemption.findFirst({
            where: {
              couponId: coupon.id,
              userId,
            },
          });

          if (previousRedemption) {
            throw new Error('You have already redeemed this coupon');
          }
        }

        // 6. Record redemption
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId,
            creditsAwarded: coupon.credits,
            ipAddress,
            userAgent,
          },
        });

        // 7. Update usage count
        await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            usagesDone: { increment: 1 },
          },
        });

        // 8. Grant credits if any
        if (coupon.credits > 0) {
          await addUserCredits(
            userId,
            coupon.credits,
            // @ts-ignore - Enum match
            'COUPON_REDEMPTION' as any,
            `Redeemed coupon: ${coupon.description || code}`,
            { couponId: coupon.id },
            tx,
          );
        }

        let plan: SubscriptionPlan | null = null;
        // 9. Grant subscription if any
        if (coupon.planId && coupon.durationDays) {
          plan = await tx.subscriptionPlan.findUnique({
            where: { planId: coupon.planId },
          });

          if (!plan) {
            throw new Error('Invalid subscription plan attached to coupon');
          }

          const now = new Date();
          const grantDurationMs = coupon.durationDays * 24 * 60 * 60 * 1000;

          // Check if user already has an active subscription for this plan
          const existingSub = await tx.subscription.findFirst({
            where: {
              userId,
              planId: coupon.planId,
              status: 'ACTIVE',
            },
          });

          if (existingSub && existingSub.currentPeriodEnd) {
            // Extend existing subscription
            const newEnd = new Date(existingSub.currentPeriodEnd.getTime() + grantDurationMs);
            await tx.subscription.update({
              where: { id: existingSub.id },
              data: {
                currentPeriodEnd: newEnd,
                metadata: {
                  ...((existingSub.metadata as Record<string, unknown>) || {}),
                  lastExtendedViaCoupon: coupon.id,
                  extensionDate: now,
                },
              },
            });
          } else {
            // Create new active subscription
            const expiresAt = new Date(now.getTime() + grantDurationMs);
            await tx.subscription.create({
              data: {
                userId,
                planId: coupon.planId,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: expiresAt,
                metadata: {
                  grantedViaCoupon: true,
                  couponId: coupon.id,
                },
              },
            });
          }

          // Invalidate subscription cache if it exists
          try {
            await redis.del(`${REDIS_KEYS.USER_SUBSCRIPTION_CACHE}${userId}`);
          } catch {
            logger.warn('Failed to invalidate subscription cache after coupon redemption', {
              userId,
            });
          }
        }

        // 10. Send confirmation email
        try {
          const user = await tx.user.findUnique({
            where: { userId },
            select: { email: true, firstName: true, lastName: true },
          });

          if (user) {
            await inngest.send({
              name: 'email.send',
              data: {
                to: user.email,
                subject: 'Coupon Redeemed Successfully! - FairArena',
                template: 'COUPON_REDEEMED',
                templateData: {
                  userName: `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
                  couponCode: code,
                  creditsAwarded: coupon.credits,
                  planName: plan?.name,
                  durationDays: coupon.durationDays,
                },
              },
            });
          }
        } catch (emailError) {
          logger.warn('Failed to trigger coupon redemption confirmation email', {
            userId,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }

        return {
          success: true,
          credits: coupon.credits,
          planId: coupon.planId,
          durationDays: coupon.durationDays,
        };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    logger.error('Coupon redemption failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      codeHash,
    });
    throw error;
  }
}

/**
 * Create a new coupon (Admin only helper - ideally used via admin controller)
 */
export async function createCoupon(data: {
  code: string;
  credits?: number;
  planId?: string;
  durationDays?: number;
  maxUsages?: number;
  userId?: string;
  isOneTimePerUser?: boolean;
  expiresAt?: Date;
  description?: string;
}) {
  const codeHash = hashCouponCode(data.code);

  return await prisma.coupon.create({
    data: {
      codeHash,
      credits: data.credits || 0,
      planId: data.planId,
      durationDays: data.durationDays,
      maxUsages: data.maxUsages,
      userId: data.userId,
      isOneTimePerUser: data.isOneTimePerUser ?? true,
      expiresAt: data.expiresAt,
      description: data.description,
    },
  });
}
