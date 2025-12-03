import { clerkClient } from '@clerk/express';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { sendPaymentSuccessEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { createRazorpayInvoice, getInvoiceUrl } from '../../utils/razorpay-invoice.js';
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

    // Step 3: Create Razorpay Invoice and send success notification and email
    await step.run('create-invoice-and-send-notification', async () => {
      try {
        // Get user details first
        const user = await clerkClient.users.getUser(userId);
        const userName = user.firstName || user.username || 'User';
        const userEmail = user.emailAddresses[0]?.emailAddress;

        let invoiceId: string | undefined;
        let invoiceUrl: string | undefined;

        // Create Razorpay invoice
        if (userEmail) {
          try {
            const invoice = await createRazorpayInvoice({
              paymentId,
              orderId,
              customerName: userName,
              customerEmail: userEmail,
              customerContact: paymentContact,
              amount,
              currency: 'INR',
              description: `${planName} - ${credits} credits`,
              lineItems: [
                {
                  name: planName,
                  description: `${credits} credits for ${planName}`,
                  amount,
                  quantity: 1,
                },
              ],
            });

            if (invoice) {
              invoiceId = invoice.id;
              invoiceUrl = getInvoiceUrl(invoice);

              // Update payment record with invoice details
              await prisma.payment.update({
                where: { razorpayOrderId: orderId },
                data: {
                  razorpayInvoiceId: invoiceId,
                  invoiceUrl,
                },
              });

              logger.info('Razorpay invoice created and stored', {
                userId,
                paymentId,
                invoiceId,
                invoiceUrl,
              });
            }
          } catch (invoiceError) {
            logger.error('Failed to create Razorpay invoice', {
              error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
              userId,
              paymentId,
            });
            // Continue even if invoice creation fails
          }
        }

        // Send in-app notification
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

        // Send success email with invoice URL
        if (userEmail) {
          try {
            await sendPaymentSuccessEmail(
              userEmail,
              userName,
              planName,
              amount,
              'INR',
              credits,
              orderId,
              paymentId,
              paymentMethod || 'Card',
              new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              invoiceUrl, // Pass invoice URL to email template
            );

            logger.info('Payment success email with Razorpay invoice sent', {
              userId,
              paymentId,
              email: userEmail,
              invoiceUrl,
            });
          } catch (emailError) {
            logger.error('Failed to send success email', {
              error: emailError instanceof Error ? emailError.message : String(emailError),
              userId,
              paymentId,
            });
            // Non-critical error, don't throw
          }
        }

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
