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

import { ENV } from '../../config/env.js';
import {
  sendBackupCodeUsedEmail,
  sendEmail,
  sendPasskeyAddedEmail,
  sendPasskeyRemovedEmail,
} from '../../email/v1/index.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Send email verification email
 */
export const sendEmailVerification = inngest.createFunction(
  {
    id: 'email-verification',
    retries: 3,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/verification' },
  async ({ event, step }) => {
    const { userId, email, firstName, token } = event.data;

    await step.run('send-verification-email', async () => {
      const verificationUrl = `${ENV.FRONTEND_URL}/verify-email/${token}`;

      try {
        await sendEmail({
          to: email,
          subject: 'Verify your FairArena email',
          templateType: 'EMAIL_VERIFICATION',
          templateData: {
            firstName: firstName || 'there',
            verificationUrl,
            expiryHours: 24,
          },
        });

        logger.info('Verification email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send verification email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = inngest.createFunction(
  {
    id: 'email-password-reset',
    retries: 3,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/password-reset' },
  async ({ event, step }) => {
    const { userId, email, firstName, token } = event.data;

    await step.run('send-password-reset-email', async () => {
      const resetUrl = `${ENV.FRONTEND_URL}/reset-password/${token}`;

      try {
        await sendEmail({
          to: email,
          subject: 'Reset your FairArena password',
          templateType: 'PASSWORD_RESET',
          templateData: {
            firstName: firstName || 'there',
            resetUrl,
            expiryMinutes: 60,
          },
        });

        logger.info('Password reset email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send password reset email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);

/**
 * Send login notification email (for suspicious login detection)
 */
export const sendLoginNotification = inngest.createFunction(
  {
    id: 'email-login-notification',
    retries: 2,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/login-notification' },
  async ({ event, step }) => {
    const { userId, email, firstName, ipAddress, deviceName, location, loginTime } = event.data;

    await step.run('send-login-notification-email', async () => {
      try {
        await sendEmail({
          to: email,
          subject: 'New login to your FairArena account',
          templateType: 'LOGIN_NOTIFICATION',
          templateData: {
            firstName: firstName || 'there',
            ipAddress: ipAddress || 'Unknown',
            deviceName: deviceName || 'Unknown device',
            location: location || 'Unknown location',
            loginTime: loginTime || new Date().toISOString(),
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('Login notification email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send login notification email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - this is not critical
      }
    });
  },
);

/**
 * Send password changed confirmation email
 */
export const sendPasswordChangedEmail = inngest.createFunction(
  {
    id: 'email-password-changed',
    retries: 2,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/password-changed' },
  async ({ event, step }) => {
    const { userId, email, firstName } = event.data;

    await step.run('send-password-changed-email', async () => {
      try {
        await sendEmail({
          to: email,
          subject: 'Your FairArena password was changed',
          templateType: 'PASSWORD_CHANGED',
          templateData: {
            firstName: firstName || 'there',
            supportUrl: `${ENV.FRONTEND_URL}/support`,
            changeTime: new Date().toISOString(),
          },
        });

        logger.info('Password changed email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send password changed email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - this is not critical
      }
    });
  },
);
/**
 * Send passkey added email
 */
export const sendPasskeyAddedHandler = inngest.createFunction(
  {
    id: 'email-passkey-added',
    retries: 3,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/passkey-added' },
  async ({ event, step }) => {
    const { userId, email, firstName, passkeyName } = event.data;

    await step.run('send-passkey-added-email', async () => {
      try {
        await sendPasskeyAddedEmail(email, firstName, passkeyName);
        logger.info('Passkey added email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send passkey added email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);

/**
 * Send passkey removed email
 */
export const sendPasskeyRemovedHandler = inngest.createFunction(
  {
    id: 'email-passkey-removed',
    retries: 3,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/passkey-removed' },
  async ({ event, step }) => {
    const { userId, email, firstName, passkeyName } = event.data;

    await step.run('send-passkey-removed-email', async () => {
      try {
        await sendPasskeyRemovedEmail(email, firstName, passkeyName);
        logger.info('Passkey removed email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send passkey removed email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);

/**
 * Send backup code used alert email
 */
export const sendBackupCodeUsedHandler = inngest.createFunction(
  {
    id: 'email-backup-code-used',
    retries: 3,
    concurrency: {
      limit: 10,
    },
  },
  { event: 'email/backup-code-used' },
  async ({ event, step }) => {
    const { userId, email, firstName, remainingCodes, ipAddress, deviceName } = event.data;

    await step.run('send-backup-code-used-email', async () => {
      try {
        await sendBackupCodeUsedEmail(email, firstName, ipAddress, deviceName, remainingCodes);
        logger.info('Backup code used email sent', { userId, email });
      } catch (error) {
        logger.error('Failed to send backup code used email', {
          userId,
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);
