import { sendEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const sendEmailHandler = inngest.createFunction(
  { id: 'send-email' },
  { event: 'email.send' },
  async ({ event }) => {
    const { to, subject, template, templateData } = event.data;

    if (!to || !subject || !template) {
      logger.error('Missing required fields in email.send event', { event });
      throw new Error('Missing required fields: to, subject, template');
    }

    try {
      await sendEmail(to, subject, template, templateData || {});
      logger.info('Email sent successfully', { to, subject, template });
    } catch (error) {
      logger.error('Failed to send email', { to, subject, template, error });
      throw error;
    }
  },
);
