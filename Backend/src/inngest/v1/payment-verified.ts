import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const paymentVerified = inngest.createFunction(
  {
    id: 'payment/verified',
    name: 'Process Payment Verification and Credit Award',
    retries: 3,
  },
  { event: 'payment/verified' },
  async ({ event, step }) => {
    const {
      userId,
      orderId,
      paymentId,
      signature,
      planId,
      planName,
      amount,
      credits,
      paymentMethod,
      paymentContact,
    } = event.data;

    const readOnlyPrisma = await getReadOnlyPrisma();

    // Step 1: Verify payment is not already processed
    const result = await step.run('check-duplicate-verification', async () => {
      const existingPayment = await readOnlyPrisma.payment.findUnique({
        where: { razorpayPaymentId: paymentId },
      });

      if (existingPayment && existingPayment.status === 'COMPLETED') {
        logger.warn('Payment already completed', {
          paymentId,
          existingStatus: existingPayment.status,
        });
        return { success: false, reason: 'already_completed', paymentDbId: existingPayment.id };
      }

      return { success: true, existingPayment };
    });

    if (!result.success) {
      return result;
    }

    // Step 2: Update payment record and award credits in transaction
    const paymentResult = await step.run('update-payment-and-award-credits', async () => {
      try {
        return await prisma.$transaction(async (tx) => {
          // Update payment record
          const payment = await tx.payment.update({
            where: { razorpayOrderId: orderId },
            data: {
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
              status: 'COMPLETED',
              completedAt: new Date(),
              paymentMethod,
              paymentContact,
            },
          });

          // Get current credit balance
          const lastTransaction = await tx.creditTransaction.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });

          const currentBalance = lastTransaction?.balance || 0;
          const newBalance = currentBalance + credits;

          // Create credit transaction record
          const creditTx = await tx.creditTransaction.create({
            data: {
              userId,
              paymentId: payment.id,
              amount: credits,
              balance: newBalance,
              type: 'PURCHASE',
              description: `Credits purchased via ${planName}`,
              metadata: {
                planId,
                planName,
                orderId,
                paymentId,
                amount,
              },
            },
          });

          logger.info('Payment completed and credits awarded', {
            paymentId: payment.id,
            userId,
            credits,
            newBalance,
            creditTxId: creditTx.id,
          });

          return {
            success: true,
            paymentId: payment.id,
            creditTxId: creditTx.id,
            creditsAwarded: credits,
            newBalance,
          };
        });
      } catch (error) {
        logger.error('Failed to process payment verification', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          orderId,
          paymentId,
        });
        throw error;
      }
    });

    // Step 3: Send success notification
    await step.run('send-success-notification', async () => {
      try {
        await inngest.send({
          name: 'notification/send',
          data: {
            userId,
            type: 'SYSTEM',
            title: 'Payment Successful! 🎉',
            message: `Your payment of ₹${amount / 100} has been processed successfully.`,
            description: `${credits} credits have been added to your account. Your new balance is ${paymentResult.newBalance} credits.`,
            actionUrl: '/dashboard/credits',
            actionLabel: 'View Credits',
          },
        });

        logger.info('Payment success notification sent', { userId, paymentId });
        return { success: true };
      } catch (error) {
        logger.error('Failed to send payment success notification', {
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
        // Non-critical, don't throw
        return { success: false };
      }
    });

    // Step 4: Log audit event
    await step.run('log-audit-event', async () => {
      try {
        await prisma.logs.create({
          data: {
            userId,
            action: 'payment.completed',
            level: 'INFO',
            metadata: {
              paymentId: paymentResult.paymentId,
              orderId,
              razorpayPaymentId: paymentId,
              planId,
              amount,
              credits,
              newBalance: paymentResult.newBalance,
            },
          },
        });

        return { success: true };
      } catch (error) {
        logger.error('Failed to create audit log', {
          error: error instanceof Error ? error.message : String(error),
        });
        return { success: false };
      }
    });

    return paymentResult;
  },
);
