import { sendPlatformInviteEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const inviteToPlatform = inngest.createFunction(
  { id: 'platform-invite', retries: 1 },
  { event: 'platform.invite' },
  async ({ event, step }) => {
    const { email, inviterName } = event.data;

    if (!email || !inviterName) {
      logger.error('Missing email or inviterName in platform.invite event', { email, inviterName });
      throw new Error('Email and inviterName are required');
    }

    logger.info('Starting platform invite process', { email });

    await step.run('check-disposable-email', async () => {
      try {
        logger.info('Checking if email is disposable', { email });

        const disposableCheckUrl = `https://pro-tempmail-api.onrender.com/check?email=${encodeURIComponent(email)}`;
        const response = await fetch(disposableCheckUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          const isDisposable = data.tempmail;

          if (isDisposable) {
            logger.warn('Disposable email detected, rejecting invitation', { email });
            throw new Error('Disposable emails are not allowed');
          } else {
            logger.info('Email is not disposable', { email });
          }
        } else if (response.status === 400) {
          try {
            const errorData = await response.json();
            if (
              errorData.error &&
              (errorData.error.includes('Invalid email format') ||
                errorData.error.includes('Email domain has no mail server'))
            ) {
              logger.warn('Invalid email format or domain detected, rejecting invitation', {
                email,
                error: errorData.error,
              });
              throw new Error('Invalid email address');
            }
          } catch {
            logger.warn('Could not parse 400 error response, treating as invalid', { email });
            throw new Error('Invalid email address');
          }
        } else {
          logger.warn(
            'Disposable email check API returned non-200/400 status, allowing invitation',
            {
              email,
              status: response.status,
              statusText: response.statusText,
            },
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'Disposable emails are not allowed' ||
            error.message === 'Invalid email address')
        ) {
          throw error;
        }
        logger.warn(
          'Disposable email check failed (API down/timeout), allowing invitation to continue',
          {
            email,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    });

    await step.run('send-invite-email', async () => {
      logger.info('Sending platform invite email', { email, inviterName });
      try {
        await sendPlatformInviteEmail(email, inviterName);
      } catch (error) {
        logger.error('Error sending platform invite email', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await inngest.send({
      name: 'newsletter.subscribe',
      data: {
        email,
      },
    });

    logger.info('Platform invite process completed successfully', { email, inviterName });
  },
);
