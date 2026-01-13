import jwt from 'jsonwebtoken';
import { generateAccessToken, getSession } from '../../services/auth.service.js';
import { publishToStream } from '../../services/stream.service.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Token refresh scheduler using Inngest for durable, distributed scheduling
 *
 * Schedules token refresh at 80% of token expiry time
 * Survives process restarts and is claimable by any healthy worker
 */
export const scheduleTokenRefresh = inngest.createFunction(
    {
        id: 'auth-schedule-token-refresh',
        name: 'Schedule Token Refresh',
    },
    { event: 'auth/session.created' },
    async ({ event, step }) => {
        const { sessionId, userId, accessToken } = event.data;

        // Calculate refresh time (80% of token expiry)
        const decoded = jwt.decode(accessToken) as { exp: number };
        if (!decoded || !decoded.exp) {
            logger.error('Failed to decode token for refresh scheduling', { sessionId });
            return { success: false, error: 'Invalid token' };
        }

        const expiryMs = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const ttl = expiryMs - now;
        const refreshAt = now + (ttl * 0.8); // 80% threshold
        const delay = refreshAt - now;

        logger.info('Scheduling token refresh', {
            sessionId,
            userId,
            refreshAt: new Date(refreshAt).toISOString(),
            delayMs: delay,
        });

        // Schedule the refresh using Inngest's sleep
        await step.sleep('wait-for-refresh-time', delay);

        // Verify session still exists
        const session = await step.run('verify-session', async () => {
            return await getSession(sessionId);
        });

        if (!session) {
            logger.info('Session no longer exists, skipping token refresh', { sessionId });
            return { success: false, error: 'Session not found' };
        }

        if (session.isBanned) {
            logger.info('Session is banned, skipping token refresh', { sessionId });
            return { success: false, error: 'Session banned' };
        }

        // Generate new token
        const newToken = await step.run('generate-new-token', async () => {
            return generateAccessToken(userId, sessionId);
        });

        // Emit token refresh event via StreamService
        await step.run('emit-token-refresh-event', async () => {
            await publishToStream(sessionId, {
                type: 'auth.token.refresh',
                data: { token: newToken },
            });
            logger.info('Token refresh event emitted', { sessionId });
        });

        // Schedule next refresh
        await step.run('schedule-next-refresh', async () => {
            await inngest.send({
                name: 'auth/session.created',
                data: {
                    sessionId,
                    userId,
                    accessToken: newToken,
                },
            });
        });

        return { success: true, sessionId, refreshedAt: Date.now() };
    },
);

/**
 * Emit session revocation event
 * Triggered when session is revoked (logout, ban, etc.)
 */
export const emitSessionRevoked = inngest.createFunction(
    {
        id: 'auth-emit-session-revoked',
        name: 'Emit Session Revoked Event',
    },
    { event: 'auth/session.revoked' },
    async ({ event, step }) => {
        const { sessionId, reason, banReason } = event.data;

        await step.run('emit-revocation-event', async () => {
            await publishToStream(sessionId, {
                type: 'auth.session.revoked',
                data: { reason, banReason },
            });
            logger.info('Session revocation event emitted', { sessionId, reason });
        });

        return { success: true, sessionId };
    },
);
