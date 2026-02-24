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

import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Clean up expired OAuth tokens
 * Runs hourly to remove expired authorization codes and tokens
 */
export const cleanupExpiredTokens = inngest.createFunction(
  { id: 'oauth-cleanup-expired-tokens', name: 'OAuth: Cleanup Expired Tokens' },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    const now = new Date();

    // Step 1: Delete expired authorization codes
    const deletedCodes = await step.run('delete-expired-auth-codes', async () => {
      const result = await prisma.oAuthAuthorizationCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null } }, // Also clean up used codes
          ],
        },
      });
      return result.count;
    });

    // Step 2: Delete expired access tokens
    const deletedAccessTokens = await step.run('delete-expired-access-tokens', async () => {
      const result = await prisma.oAuthAccessToken.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });
      return result.count;
    });

    // Step 3: Delete expired/rotated refresh tokens
    const deletedRefreshTokens = await step.run('delete-expired-refresh-tokens', async () => {
      const result = await prisma.oAuthRefreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { rotatedAt: { not: null } }, // Clean up rotated tokens
          ],
        },
      });
      return result.count;
    });

    // Step 4: Delete expired authorization requests
    const deletedRequests = await step.run('delete-expired-auth-requests', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await prisma.oAuthAuthorizationRequest.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { status: 'used', completedAt: { lt: oneDayAgo } }],
        },
      });
      return result.count;
    });

    logger.info('OAuth token cleanup completed', {
      deletedCodes,
      deletedAccessTokens,
      deletedRefreshTokens,
      deletedRequests,
    });

    return {
      success: true,
      deletedCodes,
      deletedAccessTokens,
      deletedRefreshTokens,
      deletedRequests,
    };
  },
);

/**
 * Calculate application statistics
 * Runs every 15 minutes to update activeUsers and activeTokens counts
 */
export const calculateApplicationStats = inngest.createFunction(
  { id: 'oauth-calculate-app-stats', name: 'OAuth: Calculate Application Stats' },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    // Get all active applications
    const applications = await step.run('fetch-applications', async () => {
      return prisma.oAuthApplication.findMany({
        where: { isActive: true },
        select: { id: true },
      });
    });

    // Calculate stats for each application
    const results = await step.run('calculate-stats', async () => {
      const stats = [];

      for (const app of applications) {
        const [activeUsers, activeTokens] = await Promise.all([
          // Count unique users with active consents
          prisma.oAuthConsent.count({
            where: {
              applicationId: app.id,
              revokedAt: null,
            },
          }),
          // Count active access tokens
          prisma.oAuthAccessToken.count({
            where: {
              applicationId: app.id,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          }),
        ]);

        stats.push({
          applicationId: app.id,
          activeUsers,
          activeTokens,
        });
      }

      return stats;
    });

    logger.info('Application stats calculated', {
      applicationsProcessed: applications.length,
    });

    return {
      success: true,
      applicationsProcessed: applications.length,
      stats: results,
    };
  },
);

/**
 * Archive old OAuth audit logs
 * Runs daily to archive logs older than 90 days
 */
export const archiveOldAuditLogs = inngest.createFunction(
  { id: 'oauth-archive-audit-logs', name: 'OAuth: Archive Old Audit Logs' },
  { cron: '0 2 * * *' }, // Daily at 2 AM
  async ({ step }) => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const archivedCount = await step.run('archive-old-logs', async () => {
      // In a real implementation, you might move these to a separate archive table
      // For now, we'll just delete very old logs
      const result = await prisma.oAuthAuditLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });
      return result.count;
    });

    logger.info('OAuth audit logs archived', {
      archivedCount,
    });

    return {
      success: true,
      archivedCount,
    };
  },
);

/**
 * Send email notification when user authorizes a new OAuth app
 */
export const sendOAuthAppAuthorizedEmail = inngest.createFunction(
  {
    id: 'oauth-app-authorized-email',
    name: 'OAuth: Send App Authorized Email',
    retries: 3,
  },
  { event: 'oauth/app-authorized' },
  async ({ event, step }) => {
    const { userId, applicationId, permissions, ipAddress, userAgent, isFirstAuthorization } =
      event.data;

    // Only send email for first-time authorizations
    if (!isFirstAuthorization) {
      return { success: true, skipped: true, reason: 'Not first authorization' };
    }

    return await step.run('send-oauth-app-authorized-email', async () => {
      try {
        // Fetch user details
        const user = await prisma.user.findUnique({
          where: { userId },
          select: { email: true, firstName: true },
        });

        if (!user || !user.email) {
          logger.warn('User not found for OAuth app authorized email', { userId });
          return { success: false, reason: 'User not found' };
        }

        // Fetch application details
        const application = await prisma.oAuthApplication.findUnique({
          where: { id: applicationId },
          select: {
            name: true,
            logoUrl: true,
            owner: {
              select: { firstName: true, lastName: true },
            },
          },
        });

        if (!application) {
          logger.warn('Application not found for OAuth app authorized email', { applicationId });
          return { success: false, reason: 'Application not found' };
        }

        // Parse user agent for device info
        const { parseUserAgent } = await import('../../services/auth.service.js');
        const { deviceName } = parseUserAgent(userAgent);

        // Get location from IP
        const { getLocationFromIP, formatLocationString } =
          await import('../../utils/location.utils.js');
        const locationData = await getLocationFromIP(ipAddress || 'unknown');
        const location = formatLocationString(locationData, ipAddress || 'unknown');

        // Get frontend URL
        const { ENV } = await import('../../config/env.js');

        // Send email using the template
        const { sendEmail } = await import('../../email/v1/send-mail.js');
        await sendEmail({
          to: user.email,
          subject: `${application.name} was granted access to your account`,
          templateType: 'oauth-app-authorized',
          templateData: {
            firstName: user.firstName || 'there',
            appName: application.name,
            appLogoUrl: application.logoUrl ?? undefined,
            appDeveloper: application.owner
              ? `${application.owner.firstName || ''} ${application.owner.lastName || ''}`.trim()
              : undefined,
            permissions: permissions || ['Access your basic profile'],
            authorizedAt: new Date().toISOString(),
            ipAddress: ipAddress || 'Unknown',
            location,
            deviceName: deviceName || 'Unknown device',
            revokeUrl: `${ENV.FRONTEND_URL}/dashboard/settings/connected-apps`,
            securityUrl: `${ENV.FRONTEND_URL}/dashboard/account-settings`,
          },
        });

        logger.info('OAuth app authorized email sent', {
          userId,
          email: user.email,
          applicationId,
          appName: application.name,
        });

        return { success: true };
      } catch (error) {
        logger.error('Failed to send OAuth app authorized email', { error, userId, applicationId });
        throw error;
      }
    });
  },
);

/**
 * Create in-app notification when user authorizes a new OAuth app
 */
export const createOAuthAppAuthorizedNotification = inngest.createFunction(
  {
    id: 'oauth-app-authorized-notification',
    name: 'OAuth: Create App Authorized In-App Notification',
    retries: 3,
  },
  { event: 'oauth/app-authorized' },
  async ({ event, step }) => {
    const { userId, applicationId, isFirstAuthorization } = event.data;

    // Only create notification for first-time authorizations
    if (!isFirstAuthorization) {
      return { success: true, skipped: true, reason: 'Not first authorization' };
    }

    return await step.run('create-oauth-app-authorized-notification', async () => {
      try {
        // Fetch application details
        const application = await prisma.oAuthApplication.findUnique({
          where: { id: applicationId },
          select: { name: true, logoUrl: true },
        });

        if (!application) {
          logger.warn('Application not found for OAuth notification', { applicationId });
          return { success: false, reason: 'Application not found' };
        }

        // Import notification service
        const notificationService = (await import('../../services/v1/notification.service.js'))
          .default;
        const { ENV } = await import('../../config/env.js');

        // Create notification
        await notificationService.createNotification({
          userId,
          type: 'ALERT',
          title: 'New App Connected',
          message: `${application.name} was granted access to your account`,
          description: 'You can manage connected apps in your security settings.',
          actionUrl: `${ENV.FRONTEND_URL}/dashboard/settings/connected-apps`,
          actionLabel: 'Manage Apps',
          metadata: {
            applicationId,
            appName: application.name,
            appLogoUrl: application.logoUrl,
            type: 'oauth_app_authorized',
          },
        });

        logger.info('OAuth app authorized notification created', {
          userId,
          applicationId,
          appName: application.name,
        });

        return { success: true };
      } catch (error) {
        logger.error('Failed to create OAuth app authorized notification', {
          error,
          userId,
          applicationId,
        });
        throw error;
      }
    });
  },
);

/**
 * Log OAuth data access event
 */
export const logOAuthDataAccess = inngest.createFunction(
  {
    id: 'oauth-log-data-access',
    name: 'OAuth: Log Data Access',
    retries: 2,
  },
  { event: 'oauth/data-accessed' },
  async ({ event, step }) => {
    const { userId, applicationId, endpoint, scopes, ipAddress, userAgent } = event.data;

    return await step.run('log-oauth-data-access', async () => {
      try {
        // Create audit log entry
        await prisma.oAuthAuditLog.create({
          data: {
            eventType: 'data_access',
            applicationId,
            userId,
            ipAddress,
            userAgent,
            metadata: {
              endpoint,
              scopes,
              accessedAt: new Date().toISOString(),
            },
          },
        });

        logger.debug('OAuth data access logged', {
          userId,
          applicationId,
          endpoint,
        });

        return { success: true };
      } catch (error) {
        logger.error('Failed to log OAuth data access', { error, userId, applicationId });
        throw error;
      }
    });
  },
);
