import { ENV } from '../../config/env.js';
import { sendEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Inngest function to send team invitation email
 */
export const sendTeamInviteEmail = inngest.createFunction(
  {
    id: 'team-invite-send-email',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'team/invite.send' },
  async ({ event, step }) => {
    const {
      inviteId,
      recipientEmail,
      inviterName,
      teamName,
      organizationName,
      roleName,
      inviteCode,
      expiresAt,
    } = event.data;

    logger.info('Processing team invite email', {
      inviteId,
      recipientEmail,
      teamName,
      organizationName,
    });

    await step.run('send-team-invite-email', async () => {
      try {
        // Construct invite link
        const inviteLink = `${ENV.FRONTEND_URL}/invite/team/${inviteCode}`;

        // Send email
        await sendEmail({
          to: recipientEmail,
          subject: `You've been invited to join ${teamName} on FairArena`,
          templateType: 'team-invite',
          templateData: {
            recipientEmail,
            inviterName,
            teamName,
            organizationName,
            roleName,
            inviteLink,
            expiresAt,
          },
        });

        logger.info('Team invite email sent successfully', {
          inviteId,
          recipientEmail,
          teamName,
        });
      } catch (error) {
        logger.error('Failed to send team invite email', {
          inviteId,
          recipientEmail,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    return { success: true, inviteId, recipientEmail };
  },
);

/**
 * Inngest function to create team audit log
 */
export const createTeamAuditLog = inngest.createFunction(
  {
    id: 'team-audit-log-create',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'team/audit-log.create' },
  async ({ event, step }) => {
    const { teamId, userId, action, level } = event.data;

    await step.run('create-audit-log', async () => {
      try {
        const { prisma } = await import('../../config/database.js');

        await prisma.teamAuditLog.create({
          data: {
            teamId,
            userId,
            action,
            level: level || 'INFO',
          },
        });

        logger.info('Team audit log created', {
          teamId,
          userId,
          action,
        });
      } catch (error) {
        logger.error('Failed to create team audit log', {
          teamId,
          userId,
          action,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - audit log failures shouldn't break the main flow
      }
    });

    return { success: true, teamId, action };
  },
);
