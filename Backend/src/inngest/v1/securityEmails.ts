import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { sendEmail } from '../../email/v1/send-mail.js';
import { parseUserAgent } from '../../services/auth.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Get location from IP address (simplified - can be enhanced with IP geolocation service)
 */
function getLocationFromIP(ipAddress: string): string {
  if (
    ipAddress === 'unknown' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168') ||
    ipAddress.startsWith('10.')
  ) {
    return 'Local Network';
  }
  return 'Unknown Location'; // Can integrate with IP geolocation API
}

/**
 * Send email when MFA is enabled
 */
export const sendMFAEnabledEmail = inngest.createFunction(
  {
    id: 'email/mfa-enabled',
    name: 'Send MFA Enabled Email',
    retries: 3,
  },
  { event: 'email/mfa-enabled' },
  async ({ event, step }) => {
    const { userId, ipAddress, userAgent } = event.data;

    return await step.run('send-mfa-enabled-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: {
            email: true,
            firstName: true,
            mfaEnabledAt: true,
          },
        });

        if (!user || !user.email) {
          logger.warn('User not found for MFA enabled email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);
        const location = getLocationFromIP(ipAddress || 'unknown');

        await sendEmail({
          to: user.email,
          subject: 'Two-Factor Authentication Enabled',
          templateType: 'MFA_ENABLED',
          templateData: {
            firstName: user.firstName || 'there',
            enabledAt: new Date().toLocaleString(),
            deviceName: deviceName || 'Unknown device',
            ipAddress,
            location,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('MFA enabled email sent', { userId, email: user.email });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send MFA enabled email', { error, userId });
        throw error;
      }
    });
  },
);

/**
 * Send email when MFA is disabled
 */
export const sendMFADisabledEmail = inngest.createFunction(
  {
    id: 'email/mfa-disabled',
    name: 'Send MFA Disabled Email',
    retries: 3,
  },
  { event: 'email/mfa-disabled' },
  async ({ event, step }) => {
    const { userId, ipAddress, userAgent } = event.data;

    return await step.run('send-mfa-disabled-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: {
            email: true,
            firstName: true,
          },
        });

        if (!user || !user.email) {
          logger.warn('User not found for MFA disabled email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);
        const location = getLocationFromIP(ipAddress || 'unknown');

        await sendEmail({
          to: user.email,
          subject: 'Two-Factor Authentication Disabled',
          templateType: 'MFA_DISABLED',
          templateData: {
            firstName: user.firstName || 'there',
            disabledAt: new Date().toLocaleString(),
            deviceName: deviceName || 'Unknown device',
            ipAddress,
            location,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('MFA disabled email sent', { userId, email: user.email });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send MFA disabled email', { error, userId });
        throw error;
      }
    });
  },
);

/**
 * Send email when backup codes are regenerated
 */
export const sendBackupCodesRegeneratedEmail = inngest.createFunction(
  {
    id: 'email/backup-codes-regenerated',
    name: 'Send Backup Codes Regenerated Email',
    retries: 3,
  },
  { event: 'email/backup-codes-regenerated' },
  async ({ event, step }) => {
    const { userId, codeCount, ipAddress, userAgent } = event.data;

    return await step.run('send-backup-codes-regenerated-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: {
            email: true,
            firstName: true,
          },
        });

        if (!user || !user.email) {
          logger.warn('User not found for backup codes regenerated email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);
        const location = getLocationFromIP(ipAddress || 'unknown');

        await sendEmail({
          to: user.email,
          subject: 'Backup Codes Regenerated',
          templateType: 'BACKUP_CODES_REGENERATED',
          templateData: {
            firstName: user.firstName || 'there',
            regeneratedAt: new Date().toLocaleString(),
            deviceName: deviceName || 'Unknown device',
            ipAddress,
            location,
            remainingCodes: codeCount,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('Backup codes regenerated email sent', { userId, email: user.email });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send backup codes regenerated email', { error, userId });
        throw error;
      }
    });
  },
);

/**
 * Send email when new device login is detected
 */
export const sendNewDeviceLoginEmail = inngest.createFunction(
  {
    id: 'email/new-device-login',
    name: 'Send New Device Login Email',
    retries: 3,
  },
  { event: 'email/new-device-login' },
  async ({ event, step }) => {
    const { userId, sessionId, ipAddress, userAgent } = event.data;

    return await step.run('send-new-device-login-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: {
            email: true,
            firstName: true,
          },
        });

        if (!user || !user.email) {
          logger.warn('User not found for new device login email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);

        // Extract browser info from user agent
        let browser = 'Unknown Browser';
        if (userAgent) {
          if (userAgent.includes('Chrome')) browser = 'Google Chrome';
          else if (userAgent.includes('Firefox')) browser = 'Mozilla Firefox';
          else if (userAgent.includes('Safari') && !userAgent.includes('Chrome'))
            browser = 'Safari';
          else if (userAgent.includes('Edge')) browser = 'Microsoft Edge';
          else if (userAgent.includes('Opera')) browser = 'Opera';
        }

        await sendEmail({
          to: user.email,
          subject: 'New Device Login Detected',
          templateType: 'NEW_DEVICE_LOGIN',
          templateData: {
            firstName: user.firstName || 'there',
            loginTime: new Date().toLocaleString(),
            deviceName: deviceName || 'Unknown device',
            browser,
            ipAddress,
            location: getLocationFromIP(ipAddress),
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('New device login email sent', { userId, email: user.email, sessionId });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send new device login email', { error, userId });
        throw error;
      }
    });
  },
);

/**
 * Send MFA OTP via email
 */
export const sendMfaOtpEmail = inngest.createFunction(
  {
    id: 'email/mfa-otp',
    name: 'Send MFA OTP Email',
    retries: 3,
  },
  { event: 'email/mfa-otp' },
  async ({ event, step }) => {
    const { email, firstName, otp, expiryMinutes } = event.data;

    return await step.run('send-mfa-otp-email', async () => {
      try {
        await sendEmail({
          to: email,
          subject: 'Your FairArena 2FA Code',
          templateType: 'MFA_OTP',
          templateData: {
            firstName: firstName || 'User',
            otp,
            expiryMinutes: expiryMinutes || 5,
          },
        });

        logger.info('MFA OTP email sent', { email });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send MFA OTP email', { error, email });
        throw error;
      }
    });
  },
);

/**
 * Send email when a security key is added
 */
export const sendSecurityKeyAddedEmail = inngest.createFunction(
  {
    id: 'email/security-key-added',
    name: 'Send Security Key Added Email',
    retries: 3,
  },
  { event: 'security/key-added' },
  async ({ event, step }) => {
    const { userId, keyName, addedAt, ipAddress, userAgent } = event.data;

    return await step.run('send-security-key-added-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: { email: true, firstName: true },
        });

        if (!user || !user.email) {
          logger.warn('User not found for security key added email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);
        const location = getLocationFromIP(ipAddress || 'unknown');

        await sendEmail({
          to: user.email,
          subject: 'Security Key Added',
          templateType: 'security-key-added',
          templateData: {
            firstName: user.firstName || 'there',
            keyName,
            addedAt: addedAt || new Date().toLocaleString(),
            deviceName,
            ipAddress,
            location,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('Security key added email sent', { userId, email: user.email });
        return { success: true };
      } catch (error) {
        logger.error('Failed to send security key added email', { error, userId });
        throw error;
      }
    });
  },
);

/**
 * Send email when a security key is removed
 */
export const sendSecurityKeyRemovedEmail = inngest.createFunction(
  {
    id: 'email/security-key-removed',
    name: 'Send Security Key Removed Email',
    retries: 3,
  },
  { event: 'security/key-removed' },
  async ({ event, step }) => {
    const { userId, keyName, removedAt, ipAddress, userAgent } = event.data;

    return await step.run('send-security-key-removed-email', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: { email: true, firstName: true },
        });

        if (!user || !user.email) {
          logger.warn('User not found for security key removed email', { userId });
          return { success: false, reason: 'User not found' };
        }

        const { deviceName } = parseUserAgent(userAgent);
        const location = getLocationFromIP(ipAddress || 'unknown');

        await sendEmail({
          to: user.email,
          subject: 'Security Key Removed',
          templateType: 'security-key-removed',
          templateData: {
            firstName: user.firstName || 'there',
            keyName,
            removedAt: removedAt || new Date().toLocaleString(),
            deviceName,
            ipAddress,
            location,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('Security key removed email sent', { userId, email: user.email });
        return { success: true };
      } catch (error) {
        logger.error('Failed to send security key removed email', { error, userId });
        throw error;
      }
    });
  },
);
