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
                    OR: [
                        { expiresAt: { lt: now } },
                        { status: 'used', completedAt: { lt: oneDayAgo } },
                    ],
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
    }
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
    }
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
    }
);
