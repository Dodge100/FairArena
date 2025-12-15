import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

/**
 * Process single team invitation
 */
export const processSingleTeamInvite = inngest.createFunction(
  {
    id: 'team-invite-process-single',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'team/invite.process-single' },
  async ({ event, step }) => {
    const {
      teamId,
      teamName,
      organizationName,
      email,
      roleId,
      roleName,
      firstName,
      lastName,
      expiresInDays,
      inviterId,
      inviterName,
    } = event.data;
    const readOnlyPrisma = getReadOnlyPrisma();

    logger.info('Processing single team invitation', {
      teamId,
      email,
      roleId,
    });

    // Step 1: Validate and create invite
    const invite = await step.run('create-invite', async () => {
      // Check if user is already a team member
      const existingMember = await readOnlyPrisma.userTeam.findFirst({
        where: {
          teamId,
          user: {
            email: email.toLowerCase(),
          },
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this team');
      }

      // Check for existing pending invite
      const existingInvite = await readOnlyPrisma.inviteCode.findFirst({
        where: {
          teamId,
          email: email.toLowerCase(),
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (existingInvite) {
        throw new Error('An active invitation already exists for this email');
      }

      // Generate unique invite code
      const inviteCode = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create invite in database
      return await prisma.inviteCode.create({
        data: {
          teamId,
          code: inviteCode,
          email: email.toLowerCase(),
          roleId,
          expiresAt,
          createdBy: inviterId,
          used: false,
        },
      });
    });

    // Step 2: Send invitation email
    await step.run('send-email', async () => {
      await inngest.send({
        name: 'team/invite.send',
        data: {
          inviteId: invite.id,
          recipientEmail: email,
          recipientFirstName: firstName,
          recipientLastName: lastName,
          inviterName,
          teamName,
          organizationName,
          roleName,
          inviteCode: invite.code,
          expiresAt: new Date(invite.expiresAt).toISOString(),
        },
      });
    });

    // Step 3: Create audit log
    await step.run('create-audit-log', async () => {
      await inngest.send({
        name: 'team/audit-log.create',
        data: {
          teamId,
          userId: inviterId,
          action: 'MEMBER_INVITED',
          level: 'INFO',
        },
      });
    });

    // Step 4: Invalidate cache
    await step.run('invalidate-cache', async () => {
      try {
        const pattern = `${REDIS_KEYS.USER_TEAM_CONTEXT}${teamId}:*`;
        await redis.del(pattern);
      } catch (error) {
        logger.warn('Failed to invalidate team cache', { error });
      }
    });

    logger.info('Single team invitation processed successfully', {
      inviteId: invite.id,
      teamId,
      email,
    });

    return {
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        roleName,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    };
  }
);

/**
 * Process bulk team invitations
 */
export const processBulkTeamInvites = inngest.createFunction(
  {
    id: 'team-invite-process-bulk',
    concurrency: {
      limit: 5,
    },
    retries: 2,
  },
  { event: 'team/invite.process-bulk' },
  async ({ event, step }) => {
    const {
      teamId,
      teamName,
      organizationName,
      invites,
      expiresInDays,
      inviterId,
      inviterName,
    } = event.data as {
      teamId: string;
      teamName: string;
      organizationName: string;
      invites: Array<{
        email: string;
        roleId: string;
        firstName?: string;
        lastName?: string;
      }>;
      expiresInDays: number;
      inviterId: string;
      inviterName: string;
    };
    const readOnlyPrisma = getReadOnlyPrisma();

    logger.info('Processing bulk team invitations', {
      teamId,
      count: invites.length,
    });

    type BulkInviteSuccess = {
      email: string;
      inviteId: string;
      expiresAt: Date;
    };
    type BulkInviteFailed = {
      email: string;
      error: string;
    };
    const results: {
      success: BulkInviteSuccess[];
      failed: BulkInviteFailed[];
    } = {
      success: [],
      failed: [],
    };

    // Step 1: Get all roles upfront
    const roles = await step.run('fetch-roles', async () => {
      const roleIds: string[] = [...new Set(invites.map((inv: { email: string; roleId: string; firstName?: string; lastName?: string }) => inv.roleId))];
      return await readOnlyPrisma.teamRole.findMany({
        where: {
          id: { in: roleIds },
          teamId,
        },
        select: { id: true, roleName: true },
      });
    });

    const roleMap = new Map(roles.map((r) => [r.id, r.roleName]));

    // Step 2: Process each invite
    for (const inviteData of invites) {
      await step.run(`process-invite-${inviteData.email}`, async () => {
        try {
          const { email, roleId, firstName, lastName } = inviteData;

          // Verify role
          if (!roleMap.has(roleId)) {
            results.failed.push({
              email,
              error: 'Invalid role for this team',
            });
            return;
          }

          // Check if already a member
          const existingMember = await readOnlyPrisma.userTeam.findFirst({
            where: {
              teamId,
              user: {
                email: email.toLowerCase(),
              },
            },
          });

          if (existingMember) {
            results.failed.push({
              email,
              error: 'User is already a member',
            });
            return;
          }

          // Check for existing pending invite
          const existingInvite = await readOnlyPrisma.inviteCode.findFirst({
            where: {
              teamId,
              email: email.toLowerCase(),
              used: false,
              expiresAt: {
                gt: new Date(),
              },
            },
          });

          if (existingInvite) {
            results.failed.push({
              email,
              error: 'Active invitation already exists',
            });
            return;
          }

          // Generate invite code
          const inviteCode = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiresInDays);

          // Create invite
          const invite = await prisma.inviteCode.create({
            data: {
              teamId,
              code: inviteCode,
              email: email.toLowerCase(),
              roleId,
              expiresAt,
              createdBy: inviterId,
              used: false,
            },
          });

          // Send invitation email asynchronously
          await inngest.send({
            name: 'team/invite.send',
            data: {
              inviteId: invite.id,
              recipientEmail: email,
              recipientFirstName: firstName,
              recipientLastName: lastName,
              inviterName,
              teamName,
              organizationName,
              roleName: roleMap.get(roleId)!,
              inviteCode,
              expiresAt: invite.expiresAt.toISOString(),
            },
          });

          results.success.push({
            email,
            inviteId: invite.id,
            expiresAt: invite.expiresAt,
          });
        } catch (error) {
          results.failed.push({
            email: inviteData.email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    }

    // Step 3: Create audit log if any succeeded
    if (results.success.length > 0) {
      await step.run('create-audit-log', async () => {
        await inngest.send({
          name: 'team/audit-log.create',
          data: {
            teamId,
            userId: inviterId,
            action: 'BULK_MEMBERS_INVITED',
            level: 'INFO',
          },
        });
      });
    }

    // Step 4: Invalidate cache
    await step.run('invalidate-cache', async () => {
      try {
        const pattern = `${REDIS_KEYS.USER_TEAM_CONTEXT}${teamId}:*`;
        await redis.del(pattern);
      } catch (error) {
        logger.warn('Failed to invalidate team cache', { error });
      }
    });

    logger.info('Bulk team invitations processed', {
      teamId,
      total: invites.length,
      successful: results.success.length,
      failed: results.failed.length,
    });

    return {
      success: true,
      summary: {
        total: invites.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
      results,
    };
  }
);

/**
 * Process team invitation acceptance
 */
export const processTeamInviteAcceptance = inngest.createFunction(
  {
    id: 'team-invite-accept',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'team/invite.accept' },
  async ({ event, step }) => {
    const { inviteId, userId, userEmail } = event.data;
    const readOnlyPrisma = getReadOnlyPrisma();

    logger.info('Processing team invitation acceptance', {
      inviteId,
      userId,
    });

    // Step 1: Get and validate invitation
    const invitation = await step.run('validate-invitation', async () => {
      const invite = await readOnlyPrisma.inviteCode.findUnique({
        where: { id: inviteId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          role: {
            select: {
              id: true,
              roleName: true,
            },
          },
        },
      });

      if (!invite) {
        throw new Error('Invalid invitation');
      }

      if (new Date() > invite.expiresAt) {
        throw new Error('Invitation has expired');
      }

      if (invite.used) {
        throw new Error('Invitation already used');
      }

      if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
        throw new Error('Email mismatch');
      }

      return invite;
    });

    // Step 2: Add user to organization if needed
    await step.run('ensure-organization-membership', async () => {
      const userOrg = await readOnlyPrisma.userOrganization.findFirst({
        where: {
          userId,
          organizationId: invitation.team.organizationId,
        },
      });

      if (!userOrg) {
        await prisma.userOrganization.create({
          data: {
            userId,
            organizationId: invitation.team.organizationId,
          },
        });

        logger.info('User added to organization via team invite', {
          userId,
          organizationId: invitation.team.organizationId,
        });
      }
    });

    // Step 3: Add user to team and assign role
    await step.run('add-to-team', async () => {
      await prisma.$transaction(async (tx) => {
        // Create team membership
        await tx.userTeam.create({
          data: {
            userId,
            teamId: invitation.team.id,
          },
        });

        // Assign team role
        await tx.teamUserRole.create({
          data: {
            userId,
            teamId: invitation.team.id,
            roleId: invitation.role.id,
          },
        });

        // Mark invitation as used
        await tx.inviteCode.update({
          where: { id: inviteId },
          data: { used: true },
        });
      });
    });

    // Step 4: Send notification
    await step.run('send-notification', async () => {
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'TEAM_JOINED',
          title: 'Welcome to the Team!',
          description: `You've successfully joined ${invitation.team.name}`,
          message: `You are now a member of ${invitation.team.name} in ${invitation.team.organization.name} organization with the role of ${invitation.role.roleName}.`,
        },
      });
    });

    // Step 5: Create audit log
    await step.run('create-audit-log', async () => {
      await inngest.send({
        name: 'team/audit-log.create',
        data: {
          teamId: invitation.team.id,
          userId,
          action: 'MEMBER_JOINED',
          level: 'INFO',
        },
      });
    });

    // Step 6: Invalidate caches
    await step.run('invalidate-caches', async () => {
      try {
        await Promise.all([
          redis.del(`${REDIS_KEYS.USER_TEAM_CONTEXT}${invitation.team.id}:${userId}`),
          redis.del(`${REDIS_KEYS.USER_TEAMS}${userId}`),
          redis.del(
            `${REDIS_KEYS.USER_ORGANIZATION_CONTEXT}${invitation.team.organizationId}:${userId}`
          ),
        ]);
      } catch (error) {
        logger.warn('Failed to invalidate cache', { error });
      }
    });

    logger.info('Team invitation accepted successfully', {
      inviteId,
      userId,
      teamId: invitation.team.id,
    });

    return {
      success: true,
      team: {
        id: invitation.team.id,
        name: invitation.team.name,
        slug: invitation.team.slug,
        organizationSlug: invitation.team.organization.slug,
        roleName: invitation.role.roleName,
      },
    };
  }
);
