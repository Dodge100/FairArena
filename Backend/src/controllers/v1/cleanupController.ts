import type { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { razorpay } from '../../config/razorpay.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';
import { ENV } from '../../config/env.js';

export const cleanupExpiredData = async (req: Request, res: Response) => {
  const readOnlyPrisma = await getReadOnlyPrisma();
  try {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${ENV.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Calculate dates
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Delete old logs
    const deletedLogs = await prisma.logs.deleteMany({
      where: {
        createdAt: {
          lt: sixtyDaysAgo,
        },
      },
    });

    // Get users to be permanently deleted
    const usersToDelete = await readOnlyPrisma.user.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      select: { userId: true, email: true },
    });

    // Send permanent deletion emails
    for (const user of usersToDelete) {
      try {
        inngest.send({
          name: 'email.send',
          data: {
            to: user.email,
            subject: 'Your Account Has Been Permanently Deleted',
            template: 'account-permanent-deletion',
            templateData: {},
          },
        });
      } catch (emailError: unknown) {
        logger.error(`Failed to send permanent deletion email to ${user.email}:`, {
          error: emailError,
        });
      }
    }

    const deletedUsers = await prisma.user.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    // Handle expired pending payments
    let recheckedPayments = 0;
    let cancelledPayments = 0;
    if (razorpay) {
      // First, handle payments pending for more than 7 days (recheck)
      const sevenDayPendingPayments = await readOnlyPrisma.payment.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
      });

      for (const payment of sevenDayPendingPayments) {
        try {
          // Recheck with Razorpay
          const order = await razorpay.orders.fetch(payment.razorpayOrderId);

          if (order.status === 'paid') {
            // If somehow paid, trigger verification
            await inngest.send({
              name: 'payment/verified',
              data: {
                userId: payment.userId,
                orderId: payment.razorpayOrderId,
                paymentId: '',
                signature: '',
                planId: payment.planId,
                planName: payment.planName,
                amount: payment.amount,
                credits: payment.credits,
                paymentMethod: '',
                paymentContact: '',
              },
            });
            logger.info('Late payment detected and verified', { paymentId: payment.id });
          } else {
            recheckedPayments++;
            logger.info('Payment still pending after 7 days', { paymentId: payment.id });
          }
        } catch (error) {
          logger.error('Error rechecking 7-day pending payment with Razorpay', {
            paymentId: payment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Then, handle payments pending for more than 2 weeks (cancel)
      const twoWeekPendingPayments = await readOnlyPrisma.payment.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: twoWeeksAgo,
          },
        },
      });

      for (const payment of twoWeekPendingPayments) {
        try {
          // Recheck with Razorpay one more time
          const order = await razorpay.orders.fetch(payment.razorpayOrderId);

          // If still not captured/failed, mark as cancelled
          if (order.status === 'created' || order.status === 'attempted') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'CANCELLED',
                failureReason: 'System cancelled the order due to inactivity',
              },
            });
            cancelledPayments++;
            logger.info('Payment marked as cancelled by system', { paymentId: payment.id });
          }
        } catch (error) {
          logger.error('Error checking 2-week pending payment status with Razorpay', {
            paymentId: payment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Delete old cancelled payments
    const deletedCancelledPayments = await prisma.payment.deleteMany({
      where: {
        status: 'CANCELLED',
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    res.status(200).json({
      message: 'Cleanup completed',
      deletedLogs: deletedLogs.count,
      deletedUsers: deletedUsers.count,
      deletedNotifications: deletedNotifications.count,
      recheckedPayments,
      cancelledPayments,
      deletedCancelledPayments: deletedCancelledPayments.count,
    });
  } catch (error: unknown) {
    logger.error('Error during cleanup:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
