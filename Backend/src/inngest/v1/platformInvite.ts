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

import { sendPlatformInviteEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const inviteToPlatform = inngest.createFunction(
  {
    id: 'platform-invite',
    concurrency: {
      limit: 5,
    },
    retries: 1,
  },
  { event: 'platform.invite' },
  async ({ event, step }) => {
    const { email, inviterName } = event.data;

    if (!email || !inviterName) {
      logger.error('Missing email or inviterName in platform.invite event', { email, inviterName });
      throw new Error('Email and inviterName are required');
    }

    logger.info('Starting platform invite process', { email });

    await step.run('send-invite-email', async () => {
      logger.info('Sending platform invite email', { email, inviterName });
      await sendPlatformInviteEmail(email, inviterName);
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
