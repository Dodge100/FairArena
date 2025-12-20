import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import {
  sendPaymentFailedEmail,
  sendRefundCompletedEmail,
  sendRefundFailedEmail,
  sendRefundInitiatedEmail,
} from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { getCachedUserInfo } from '../../utils/userCache.js';
import { inngest } from './client.js';

export const paymentWebhookReceived = inngest.createFunction(
  {
    id: 'payment/webhook-received',
    name: 'Process Razorpay Webhook Event',
    concurrency: {
      limit: 5,
    },
    retries: 5,
  },
  { event: 'payment/webhook.received' },
  async ({ event, step }) => {
    const { eventId, eventType, payload, signature } = event.data;

    // Step 1: Check for duplicate webhook events (replay attack prevention)
    const duplicateCheck = await step.run('check-duplicate-webhook', async () => {
      try {
        const readOnlyPrisma = await getReadOnlyPrisma();
        const existingWebhook = await readOnlyPrisma.paymentWebhookEvent.findUnique({
          where: { razorpayEventId: eventId },
        });

        if (existingWebhook) {
          logger.warn('Duplicate webhook event detected', {
            eventId,
            existingWebhookId: existingWebhook.id,
            existingProcessed: existingWebhook.processed,
          });
          return { isDuplicate: true, existingWebhookId: existingWebhook.id };
        }

        return { isDuplicate: false };
      } catch (error) {
        logger.error('Failed to check for duplicate webhook', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
        });
        throw error;
      }
    });

    // If duplicate webhook, skip processing but still log
    if (duplicateCheck.isDuplicate) {
      logger.info('Skipping duplicate webhook processing', {
        eventId,
        ...('existingWebhookId' in duplicateCheck && duplicateCheck.existingWebhookId
          ? { existingWebhookId: duplicateCheck.existingWebhookId }
          : {}),
      });
      return { success: true, skipped: true, reason: 'duplicate_webhook' };
    }

    // Step 2: Store webhook event
    const webhookEvent = await step.run('store-webhook-event', async () => {
      try {
        // Extract payment entity to link webhook to payment immediately if possible
        const paymentEntity = payload.payload?.payment?.entity;
        const orderId = paymentEntity?.order_id;

        let paymentId: string | null = null;
        if (orderId) {
          const readOnlyPrisma = await getReadOnlyPrisma();
          const payment = await readOnlyPrisma.payment.findUnique({
            where: { razorpayOrderId: orderId },
          });
          paymentId = payment?.id || null;
        }

        const webhook = await prisma.paymentWebhookEvent.create({
          data: {
            razorpayEventId: eventId,
            eventType,
            payload,
            signature,
            processed: false,
            paymentId,
          },
        });

        logger.info('Webhook event stored', {
          webhookId: webhook.id,
          eventId,
          eventType,
          paymentId,
        });

        return { success: true, webhookId: webhook.id, paymentId };
      } catch (error) {
        logger.error('Failed to store webhook event', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          eventType,
        });
        throw error;
      }
    });

    // Step 3: Validate webhook payload structure
    await step.run('validate-webhook-payload', async () => {
      try {
        // Ensure payload has required Razorpay webhook structure
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid webhook payload structure');
        }

        if (!payload.event || !payload.payload) {
          throw new Error('Missing required webhook payload fields');
        }

        // Validate event type matches expected Razorpay events
        const validEventTypes = [
          'payment.captured',
          'payment.failed',
          'payment.authorized',
          'refund.created',
          'refund.processed',
          'refund.failed',
        ];

        if (!validEventTypes.includes(eventType)) {
          logger.warn('Unknown webhook event type', { eventType, eventId });
          // Don't throw error for unknown events, just log and continue
        }

        logger.info('Webhook payload validation passed', {
          eventId,
          eventType,
          hasPaymentEntity: !!payload.payload?.payment?.entity,
          hasRefundEntity: !!payload.payload?.refund?.entity,
        });

        return { success: true, valid: true };
      } catch (error) {
        logger.error('Webhook payload validation failed', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          eventType,
        });
        throw error;
      }
    });

    // Step 4: Process webhook based on event type
    const processResult = await step.run('process-webhook-event', async () => {
      try {
        const paymentEntity = payload.payload?.payment?.entity;
        const readOnlyPrisma = await getReadOnlyPrisma();

        switch (eventType) {
          case 'payment.captured': {
            if (!paymentEntity?.order_id) {
              return { success: false, reason: 'missing_order_id' };
            }

            const payment = await readOnlyPrisma.payment.findUnique({
              where: { razorpayOrderId: paymentEntity.order_id },
            });

            if (!payment) {
              logger.warn('Payment not found for captured webhook', {
                orderId: paymentEntity.order_id,
              });
              return { success: false, reason: 'payment_not_found' };
            }

            // Security check: Verify payment amounts match
            if (paymentEntity.amount !== payment.amount) {
              logger.error('Payment amount mismatch in webhook', {
                webhookAmount: paymentEntity.amount,
                storedAmount: payment.amount,
                orderId: paymentEntity.order_id,
                paymentId: payment.id,
              });
              return { success: false, reason: 'amount_mismatch' };
            }

            // Security check: Ensure payment is in expected state
            if (payment.status === 'COMPLETED') {
              logger.info('Payment already completed, skipping duplicate processing', {
                paymentId: payment.id,
                orderId: paymentEntity.order_id,
              });
              return { success: true, action: 'already_completed' };
            }

            // Update webhook-payment link if not already set
            if (!webhookEvent.paymentId) {
              await prisma.paymentWebhookEvent.update({
                where: { id: webhookEvent.webhookId },
                data: { paymentId: payment.id },
              });
            }

            // Trigger verification flow for captured payment
            await inngest.send({
              name: 'payment/verified',
              data: {
                userId: payment.userId,
                orderId: payment.razorpayOrderId,
                paymentId: paymentEntity.id,
                signature: '', // Webhook doesn't need signature
                planId: payment.planId,
                planName: payment.planName,
                amount: payment.amount,
                credits: payment.credits,
                paymentMethod: paymentEntity.method,
                paymentContact: paymentEntity.contact,
              },
            });

            logger.info('Payment verification triggered from webhook', {
              paymentId: payment.id,
              orderId: payment.razorpayOrderId,
            });

            return { success: true, action: 'payment_captured' };
          }

          case 'payment.failed': {
            if (!paymentEntity?.order_id) {
              return { success: false, reason: 'missing_order_id' };
            }

            const payment = await readOnlyPrisma.payment.findUnique({
              where: { razorpayOrderId: paymentEntity.order_id },
            });

            if (payment) {
              await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  status: 'FAILED',
                  failureReason: paymentEntity.error_description || 'Payment failed',
                  razorpayPaymentId: paymentEntity.id,
                },
              });

              // Update webhook-payment link if not already set
              if (!webhookEvent.paymentId) {
                await prisma.paymentWebhookEvent.update({
                  where: { id: webhookEvent.webhookId },
                  data: { paymentId: payment.id },
                });
              }

              // Send failure notification
              await inngest.send({
                name: 'notification/send',
                data: {
                  userId: payment.userId,
                  type: 'SYSTEM',
                  title: 'Payment Failed',
                  message: 'Your payment could not be processed.',
                  description: paymentEntity.error_description || 'Please try again.',
                },
              });

              // Send failure email
              try {
                const userInfo = await getCachedUserInfo(payment.userId);
                const userName = userInfo
                  ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
                  : 'User';
                const userEmail = userInfo?.email;

                if (userEmail) {
                  await sendPaymentFailedEmail(
                    userEmail,
                    userName,
                    payment.planName,
                    payment.amount,
                    payment.currency,
                    payment.razorpayOrderId,
                    paymentEntity.error_description || 'Payment processing failed',
                    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                    paymentEntity.id,
                  );

                  logger.info('Payment failure email sent', {
                    userId: payment.userId,
                    paymentId: payment.id,
                    email: userEmail,
                  });
                }
              } catch (emailError) {
                logger.error('Failed to send failure email', {
                  error: emailError instanceof Error ? emailError.message : String(emailError),
                  userId: payment.userId,
                  paymentId: payment.id,
                });
              }

              logger.info('Payment marked as failed from webhook', {
                paymentId: payment.id,
                reason: paymentEntity.error_description,
              });
            }

            return { success: true, action: 'payment_failed' };
          }

          case 'refund.created': {
            const refundEntity = payload.payload?.refund?.entity;
            if (!refundEntity?.payment_id) {
              return { success: false, reason: 'missing_payment_id' };
            }

            const payment = await readOnlyPrisma.payment.findUnique({
              where: { razorpayPaymentId: refundEntity.payment_id },
            });

            if (payment) {
              const isFullRefund = refundEntity.amount === payment.amount;

              await prisma.$transaction(async (tx) => {
                // Update payment with refund info
                await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                    refundId: refundEntity.id,
                    refundAmount: refundEntity.amount,
                    refundedAt: new Date(),
                  },
                });

                // Get current balance
                const lastTransaction = await tx.creditTransaction.findFirst({
                  where: { userId: payment.userId },
                  orderBy: { createdAt: 'desc' },
                });

                const currentBalance = lastTransaction?.balance || 0;
                const refundCredits = Math.floor(
                  (refundEntity.amount / payment.amount) * payment.credits,
                );
                const newBalance = currentBalance - refundCredits;

                // Create refund credit transaction
                await tx.creditTransaction.create({
                  data: {
                    userId: payment.userId,
                    paymentId: payment.id,
                    amount: -refundCredits,
                    balance: newBalance,
                    type: 'REFUND',
                    description: `Refund for ${payment.planName}`,
                    metadata: {
                      refundId: refundEntity.id,
                      refundAmount: refundEntity.amount,
                      originalAmount: payment.amount,
                    },
                  },
                });

                // Update webhook-payment link if not already set
                if (!webhookEvent.paymentId) {
                  await tx.paymentWebhookEvent.update({
                    where: { id: webhookEvent.webhookId },
                    data: { paymentId: payment.id },
                  });
                }
              });

              // Send refund email
              try {
                const userInfo = await getCachedUserInfo(payment.userId);
                const userName = userInfo
                  ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
                  : 'User';
                const userEmail = userInfo?.email;

                if (userEmail) {
                  const refundCredits = Math.floor(
                    (refundEntity.amount / payment.amount) * payment.credits,
                  );

                  await sendRefundInitiatedEmail(
                    userEmail,
                    userName,
                    payment.planName,
                    refundEntity.amount,
                    payment.amount,
                    payment.currency,
                    refundCredits,
                    payment.razorpayOrderId,
                    payment.razorpayPaymentId || 'N/A',
                    refundEntity.id,
                    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                    '5-7 business days',
                  );

                  logger.info('Refund email sent', {
                    userId: payment.userId,
                    paymentId: payment.id,
                    email: userEmail,
                  });
                }
              } catch (emailError) {
                logger.error('Failed to send refund email', {
                  error: emailError instanceof Error ? emailError.message : String(emailError),
                  userId: payment.userId,
                  paymentId: payment.id,
                });
              }

              // Send refund initiated notification
              await inngest.send({
                name: 'notification/send',
                data: {
                  userId: payment.userId,
                  type: 'SYSTEM',
                  title: 'Refund Initiated',
                  message: `Your refund request for ₹${(refundEntity.amount / 100).toFixed(2)} has been initiated.`,
                  description: `Refund for ${payment.planName} is being processed. You will receive the amount in 5-7 business days.`,
                  actionUrl: '/dashboard/billing',
                  actionLabel: 'View Details',
                },
              });

              logger.info('Refund processed from webhook', {
                paymentId: payment.id,
                refundId: refundEntity.id,
                isFullRefund,
              });
            }

            return { success: true, action: 'refund_created' };
          }

          case 'refund.processed': {
            const refundEntity = payload.payload?.refund?.entity;
            if (!refundEntity?.payment_id) {
              return { success: false, reason: 'missing_payment_id' };
            }

            const payment = await readOnlyPrisma.payment.findUnique({
              where: { razorpayPaymentId: refundEntity.payment_id },
            });

            if (payment) {
              // Send refund completed notification
              await inngest.send({
                name: 'notification/send',
                data: {
                  userId: payment.userId,
                  type: 'SYSTEM',
                  title: 'Refund Completed',
                  message: `Your refund of ₹${(refundEntity.amount / 100).toFixed(2)} has been processed successfully.`,
                  description: `Refund for ${payment.planName} has been credited to your account.`,
                  actionUrl: '/dashboard/billing',
                  actionLabel: 'View Details',
                },
              });

              // Send refund completed email
              try {
                const userInfo = await getCachedUserInfo(payment.userId);
                const userName = userInfo
                  ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
                  : 'User';
                const userEmail = userInfo?.email;

                if (userEmail) {
                  await sendRefundCompletedEmail(
                    userEmail,
                    userName,
                    payment.planName,
                    refundEntity.amount,
                    payment.currency,
                    payment.razorpayOrderId,
                    payment.razorpayPaymentId || 'N/A',
                    refundEntity.id,
                    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                    paymentEntity?.method || 'bank account',
                  );

                  logger.info('Refund completed email sent', {
                    userId: payment.userId,
                    paymentId: payment.id,
                    email: userEmail,
                  });
                }
              } catch (emailError) {
                logger.error('Failed to send refund completed email', {
                  error: emailError instanceof Error ? emailError.message : String(emailError),
                  userId: payment.userId,
                  paymentId: payment.id,
                });
              }

              logger.info('Refund processed notification sent', {
                paymentId: payment.id,
                refundId: refundEntity.id,
              });
            }

            return { success: true, action: 'refund_processed' };
          }

          case 'refund.failed': {
            const refundEntity = payload.payload?.refund?.entity;
            if (!refundEntity?.payment_id) {
              return { success: false, reason: 'missing_payment_id' };
            }

            const payment = await readOnlyPrisma.payment.findUnique({
              where: { razorpayPaymentId: refundEntity.payment_id },
            });

            if (payment) {
              // Send refund failed notification
              await inngest.send({
                name: 'notification/send',
                data: {
                  userId: payment.userId,
                  type: 'SYSTEM',
                  title: 'Refund Failed',
                  message: `Your refund request for ₹${(refundEntity.amount / 100).toFixed(2)} could not be processed.`,
                  description: `Please contact support for assistance with your refund for ${payment.planName}.`,
                  actionUrl: '/support',
                  actionLabel: 'Contact Support',
                },
              });

              // Send refund failed email
              try {
                const userInfo = await getCachedUserInfo(payment.userId);
                const userName = userInfo
                  ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
                  : 'User';
                const userEmail = userInfo?.email;

                if (userEmail) {
                  await sendRefundFailedEmail(
                    userEmail,
                    userName,
                    payment.planName,
                    refundEntity.amount,
                    payment.currency,
                    payment.razorpayOrderId,
                    payment.razorpayPaymentId || 'N/A',
                    refundEntity.id,
                    refundEntity.error_description || 'Refund processing failed',
                    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                  );

                  logger.info('Refund failed email sent', {
                    userId: payment.userId,
                    paymentId: payment.id,
                    email: userEmail,
                  });
                }
              } catch (emailError) {
                logger.error('Failed to send refund failed email', {
                  error: emailError instanceof Error ? emailError.message : String(emailError),
                  userId: payment.userId,
                  paymentId: payment.id,
                });
              }

              logger.info('Refund failed notification sent', {
                paymentId: payment.id,
                refundId: refundEntity.id,
              });
            }

            return { success: true, action: 'refund_failed' };
          }

          default:
            logger.info('Unhandled webhook event type', { eventType });
            return { success: true, action: 'unhandled_event' };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error('Webhook processing error', {
          error: errorMessage,
          stack: errorStack,
          webhookId: webhookEvent.webhookId,
          eventType,
          eventId,
        });

        // Update webhook with comprehensive error information
        try {
          await prisma.paymentWebhookEvent.update({
            where: { id: webhookEvent.webhookId },
            data: {
              errorMessage: `${errorMessage}${errorStack ? `\n\nStack: ${errorStack}` : ''}`,
              retryCount: { increment: 1 },
            },
          });
        } catch (updateError) {
          logger.error('Failed to update webhook with error message', {
            updateError: updateError instanceof Error ? updateError.message : String(updateError),
            originalError: errorMessage,
          });
        }

        throw error;
      }
    });

    // Step 5: Mark webhook as processed
    await step.run('mark-webhook-processed', async () => {
      await prisma.$transaction(async (tx) => {
        // Mark webhook event as processed
        await tx.paymentWebhookEvent.update({
          where: { id: webhookEvent.webhookId },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });

        // Update payment's webhookProcessed field if payment exists
        const webhookRecord = await tx.paymentWebhookEvent.findUnique({
          where: { id: webhookEvent.webhookId },
          include: { payment: true },
        });

        if (webhookRecord?.paymentId) {
          await tx.payment.update({
            where: { id: webhookRecord.paymentId },
            data: {
              webhookProcessed: true,
              webhookProcessedAt: new Date(),
            },
          });
        }
      });

      logger.info('Webhook marked as processed', {
        webhookId: webhookEvent.webhookId,
        result: processResult,
      });

      return { success: true };
    });

    return { success: true, webhookId: webhookEvent.webhookId, result: processResult };
  },
);
