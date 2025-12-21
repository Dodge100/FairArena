import { prisma } from '../../config/database.js';
import { SupportService } from '../../services/v1/supportService.js';
import logger from '../../utils/logger.js';
import { getCachedUserInfo } from '../../utils/userCache.js';
import { inngest } from './client.js';

export const supportRequestCreated = inngest.createFunction(
  {
    id: 'support-request-created',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'support/request-created' },
  async ({ event, step }) => {
    const { tempId, userId, emailId, subject, message, userEmail, userName } = event.data;

    // Step 1: Check disposable email for unauthenticated users
    if (!userId && emailId) {
      const shouldContinue = await step.run('check-disposable-email', async () => {
        try {
          logger.info('Checking if email is disposable', { email: emailId });

          const disposableCheckUrl = `https://pro-tempmail-api.onrender.com/check?email=${encodeURIComponent(emailId)}`;
          const response = await fetch(disposableCheckUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          if (response.ok) {
            const data = await response.json();
            const isDisposable = data.tempmail;

            if (isDisposable) {
              logger.warn('Disposable email detected, skipping support request creation', {
                email: emailId,
              });
              return false; // Skip further processing
            } else {
              logger.info('Email is not disposable', { email: emailId });
              return true; // Continue processing
            }
          } else if (response.status === 400) {
            // Check if it's an invalid email format or domain issue
            try {
              const errorData = await response.json();
              if (
                errorData.error &&
                (errorData.error.includes('Invalid email format') ||
                  errorData.error.includes('Email domain has no mail server'))
              ) {
                logger.warn(
                  'Invalid email format or domain detected, skipping support request creation',
                  {
                    email: emailId,
                    error: errorData.error,
                  },
                );
                return false; // Skip further processing
              }
            } catch {
              logger.warn('Could not parse 400 error response, treating as invalid and skipping', {
                email: emailId,
              });
              return false; // Skip further processing
            }
          } else {
            logger.warn(
              'Disposable email check API returned non-200/400 status, allowing support request',
              {
                email: emailId,
                status: response.status,
                statusText: response.statusText,
              },
            );
            return true; // Continue processing
          }
        } catch (error) {
          logger.warn(
            'Disposable email check failed (API down/timeout), allowing support request to continue',
            {
              email: emailId,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          return true; // Continue processing if API is down
        }
        return true; // Default to continue
      });

      // If email check failed, skip further processing
      if (!shouldContinue) {
        logger.info('Skipping support request creation due to email validation', {
          email: emailId,
          tempId,
        });
        return { success: false, reason: 'Invalid email', tempId };
      }
    }

    // Step 2: Create support request in database
    const supportData = userId
      ? { userId, emailId, subject, message }
      : { emailId, subject, message };

    const supportRequest = await step.run('create-support-request', async () => {
      return await SupportService.createSupportRequest(supportData);
    });

    await step.run('classify-support-ticket', async () => {
      try {
        logger.info('Starting AI classification for support ticket', {
          ticketId: supportRequest.id,
        });

        await SupportService.classifyAndUpdateTicket(supportRequest.id);

        logger.info('AI classification completed for support ticket', {
          ticketId: supportRequest.id,
        });
      } catch (error) {
        // Log error but don't fail the entire workflow
        logger.error('AI classification failed, continuing with default values', {
          ticketId: supportRequest.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Step 4: Get user name if not provided (for authenticated users)
    let finalUserName = userName;
    if (userId && !finalUserName) {
      await step.run('get-user-name', async () => {
        try {
          const userInfo = await getCachedUserInfo(userId);
          if (userInfo) {
            finalUserName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim();
          }
        } catch (error) {
          logger.error('Failed to get user profile for support request:', {error});
        }
      });
    }

    // Step 5: Send confirmation email to the user
    await step.run('send-confirmation-email', async () => {
      let recipientEmail = userEmail || emailId;

      // If we have userId but no email, fetch from database
      if (userId && !recipientEmail) {
        try {
          const user = await prisma.user.findUnique({
            where: { userId },
            select: { email: true },
          });
          recipientEmail = user?.email;
        } catch (error) {
          logger.error('Failed to fetch user email for support confirmation', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!recipientEmail) {
        logger.warn('No email address found for support request', {
          supportRequestId: supportRequest.id,
        });
        return;
      }

      // Fetch the latest ticket data to get classification details
      const updatedTicket = await prisma.support.findUnique({
        where: { id: supportRequest.id },
        select: {
          type: true,
          severity: true,
          shortDescription: true,
        },
      });

      await inngest.send({
        name: 'email.send',
        data: {
          to: recipientEmail,
          subject: `Support Request Received - ${subject}`,
          template: 'support-confirmation',
          templateData: {
            userName: finalUserName || 'Valued User',
            subject,
            requestId: supportRequest.id,
            type: updatedTicket?.type,
            severity: updatedTicket?.severity,
            shortDescription: updatedTicket?.shortDescription,
          },
        },
      });
    });

    // Step 6: Send in-app notification to authenticated user
    if (userId) {
      await step.run('send-in-app-notification', async () => {
        await inngest.send({
          name: 'notification/send',
          data: {
            userId,
            type: 'SYSTEM',
            title: 'Support Request Submitted',
            message: `Your support request "${subject}" has been submitted successfully.`,
            description: `Request ID: ${supportRequest.id}. Our support team will review your request and respond within 24-48 hours.`,
            actionUrl: '/support',
            actionLabel: 'View Support Requests',
            metadata: {
              supportId: supportRequest.id,
              subject,
              type: 'support_request_created',
            },
          },
        });
      });
    }

    // Step 7: Log the support request creation
    await step.run('log-support-request', async () => {
      logger.info(`Support request created: ${supportRequest.id}`, {
        userId,
        emailId,
        subject,
        timestamp: new Date().toISOString(),
      });
    });

    return { success: true, supportId: supportRequest.id, tempId };
  },
);
