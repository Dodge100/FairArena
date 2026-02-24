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
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const paymentOrderCreated = inngest.createFunction(
  {
    id: 'payment/order-created',
    name: 'Process Payment Order Creation',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'payment/order.created' },
  async ({ event, step }) => {
    const {
      userId,
      orderId,
      planId,
      planName,
      amount,
      currency,
      credits,
      ipAddress,
      userAgent,
      notes,
      receipt,
    } = event.data;

    await step.run('create-payment-record', async () => {
      try {
        const readOnlyPrisma = await getReadOnlyPrisma();
        // Check for duplicate order (idempotency)
        const existingPayment = await readOnlyPrisma.payment.findUnique({
          where: { razorpayOrderId: orderId },
        });

        if (existingPayment) {
          logger.warn('Duplicate payment order detected', {
            userId,
            orderId,
            existingPaymentId: existingPayment.id,
          });
          return { success: false, reason: 'duplicate_order' };
        }

        // Create payment record
        const payment = await prisma.payment.create({
          data: {
            userId,
            razorpayOrderId: orderId,
            planId,
            planName,
            amount,
            currency,
            credits,
            status: 'PENDING',
            ipAddress,
            userAgent,
            notes,
            receipt,
            idempotencyKey: `order_${orderId}`,
            webhookProcessed: false,
          },
        });

        logger.info('Payment record created', {
          paymentId: payment.id,
          userId,
          orderId,
          planId,
          amount,
        });

        return { success: true, paymentId: payment.id };
      } catch (error) {
        logger.error('Failed to create payment record', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          orderId,
        });
        throw error;
      }
    });
  },
);
