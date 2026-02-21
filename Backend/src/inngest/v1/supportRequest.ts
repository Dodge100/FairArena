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

    // Step 2: Analyze support request with AI
    const classification = await step.run('analyze-support-request', async () => {
      try {
        const aiService = (
          await import('../../services/v1/aiClassificationService.js')
        ).getAIClassificationService();
        return await aiService.classifySupportTicket(subject, message);
      } catch (error) {
        logger.error('Failed to classify support request', { error });
        // Return undefined to use defaults in service
        return undefined;
      }
    });

    // Step 3: Create support request in database
    const supportData = userId
      ? {
          userId,
          emailId,
          subject,
          message,
          type: classification?.type,
          severity: classification?.severity,
          shortDescription: classification?.shortDescription,
        }
      : {
          emailId,
          subject,
          message,
          type: classification?.type,
          severity: classification?.severity,
          shortDescription: classification?.shortDescription,
        };

    const supportRequest = await step.run('create-support-request', async () => {
      return await SupportService.createSupportRequest(supportData);
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
          console.warn('Failed to get user profile for support request:', error);
        }
      });
    }

    // Step 5: Send confirmation email to the user
    await step.run('send-confirmation-email', async () => {
      const recipientEmail = userEmail || emailId;
      if (!recipientEmail) {
        console.warn('No email address found for support request:', supportRequest.id);
        return;
      }

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
            severity: classification?.severity,
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
      console.log(`Support request created: ${supportRequest.id}`, {
        userId,
        emailId,
        subject,
        timestamp: new Date().toISOString(),
      });
    });

    return { success: true, supportId: supportRequest.id, tempId };
  },
);
