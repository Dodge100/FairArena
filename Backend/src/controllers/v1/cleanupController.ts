import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { razorpay } from '../../config/razorpay.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

export const performCleanup = async () => {
  const readOnlyPrisma = await getReadOnlyPrisma();
  try {
    // Calculate dates
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oneDay = new Date();
    oneDay.setDate(oneDay.getDate() - 1);

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

    const eightyDaysAgo = new Date();
    eightyDaysAgo.setDate(eightyDaysAgo.getDate() - 80);

    // Send warning emails to users who will be permanently deleted in 10 days
    const usersToWarn = await readOnlyPrisma.user.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lt: eightyDaysAgo,
          gte: ninetyDaysAgo,
        },
      },
      select: { userId: true, email: true, deletedAt: true },
    });

    let warningEmailsSent = 0;

    // Send warning emails (only if we haven't sent one recently)
    for (const user of usersToWarn) {
      try {
        // Check if we already sent a warning email in the last 7 days
        const recentWarningLog = await readOnlyPrisma.logs.findFirst({
          where: {
            userId: user.userId,
            action: 'account-deletion-warning-sent',
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!recentWarningLog) {
          const daysLeft = Math.max(
            1,
            Math.ceil(90 - (Date.now() - user.deletedAt!.getTime()) / (24 * 60 * 60 * 1000)),
          );

          inngest.send({
            name: 'email.send',
            data: {
              to: user.email,
              subject: 'Your Account Will Be Permanently Deleted Soon',
              template: 'account-deletion-warning',
              templateData: {
                recoveryInstructions:
                  'To recover your account, please sign in within the next few days. If you sign in before the deletion deadline, your account will be restored.',
                deadline: `${daysLeft} days`,
              },
            },
          });

          // Log that we sent the warning
          await prisma.logs.create({
            data: {
              userId: user.userId,
              action: 'last-account-deletion-warning-sent',
              level: 'CRITICAL',
              metadata: {
                daysLeft,
                deletedAt: user.deletedAt,
              },
            },
          });

          warningEmailsSent++;
        }
      } catch (emailError: unknown) {
        logger.error(`Failed to send deletion warning email to ${user.email}:`, {
          error: emailError,
        });
      }
    }

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
    let cancelledPayments = 0;
    if (razorpay) {
      const twoWeekPendingPayments = await readOnlyPrisma.payment.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: oneDay,
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

    const result = {
      message: 'Cleanup completed',
      deletedLogs: deletedLogs.count,
      deletedUsers: deletedUsers.count,
      deletedNotifications: deletedNotifications.count,
      warningEmailsSent,
      cancelledPayments,
    };

    // Send success heartbeat
    await fetch(`https://uptime.betterstack.com/api/v1/heartbeat/${ENV.BETTER_STACK_HEARTBEAT_ID}`)
      .then(() => logger.info('Success heartbeat sent to Better Stack'))
      .catch((error) => logger.error('Failed to send success heartbeat', { error }));

    return result;
  } catch (error: unknown) {
    logger.error('Error during cleanup:', { error });

    // Send failure heartbeat
    await fetch(
      `https://uptime.betterstack.com/api/v1/heartbeat/${ENV.BETTER_STACK_HEARTBEAT_ID}/fail`,
    )
      .then(() => logger.info('Failure heartbeat sent to Better Stack'))
      .catch((error) => logger.error('Failed to send failure heartbeat', { error }));

    throw error; // Re-throw for Inngest to handle
  }
};
