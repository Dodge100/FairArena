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

import { sendEmail, TemplateType } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const sendEmailHandler = inngest.createFunction(
  {
    id: 'send-email',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'email.send' },
  async ({ event }) => {
    const { to, subject, template, templateData } = event.data;

    if (!to || !subject || !template) {
      logger.error('Missing required fields in email.send event', { event });
      throw new Error('Missing required fields: to, subject, template');
    }

    try {
      await sendEmail({
        to,
        subject,
        templateType: template as TemplateType,
        templateData: templateData || {},
      });
      logger.info('Email sent successfully', { to, subject, template });
    } catch (error) {
      logger.error('Failed to send email', { to, subject, template, error });
      throw error;
    }
  },
);
