import { ENV } from '../../config/env.js';
import { sendEmail } from '../../email/v1/index.js';
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
