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
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

/**
 * Inngest function to handle team creation asynchronously
 * Creates team, team profile, default roles, and audit log
 */
export const createTeamFunction = inngest.createFunction(
  { id: 'team-create', name: 'Create Team' },
  { event: 'team/create' },
  async ({ event, step }) => {
    const {
      userId,
      organizationId,
      organizationSlug,
      name,
      slug,
      description,
      visibility,
      joinEnabled,
      timezone,
      website,
      logoUrl,
      location,
    } = event.data;

    // Step 1: Create the team
    const team = await step.run('create-team', async () => {
      logger.info(`Creating team: ${name} in organization: ${organizationId}`);

      return await prisma.team.create({
        data: {
          name,
          slug,
          visibility,
          joinEnabled,
          timezone,
          organizationId,
        },
      });
    });

    // Step 2: Create team profile if additional data provided
    if (description || website || logoUrl || location) {
      await step.run('create-team-profile', async () => {
        logger.info(`Creating profile for team: ${team.id}`);

        return await prisma.teamProfile.create({
          data: {
            teamId: team.id,
            description,
            website,
            logoUrl,
            location,
          },
        });
      });
    }

    // Step 3: Create default team roles
    await step.run('create-default-roles', async () => {
      logger.info(`Creating default roles for team: ${team.id}`);

      const roles = [
        {
          roleName: 'Owner',
          permissions: {
            team: { read: true, update: true, delete: true },
            members: { invite: true, remove: true, updateRole: true },
            projects: { create: true, read: true, update: true, delete: true },
            settings: { manage: true },
          },
        },
        {
          roleName: 'Admin',
          permissions: {
            team: { read: true, update: true, delete: false },
            members: { invite: true, remove: true, updateRole: true },
            projects: { create: true, read: true, update: true, delete: true },
            settings: { manage: false },
          },
        },
        {
          roleName: 'Member',
          permissions: {
            team: { read: true, update: false, delete: false },
            members: { invite: false, remove: false, updateRole: false },
            projects: { create: true, read: true, update: true, delete: false },
            settings: { manage: false },
          },
        },
      ];

      return await prisma.teamRole.createMany({
        data: roles.map((role) => ({
          teamId: team.id,
          ...role,
        })),
      });
    });

    // Step 4: Assign creator as Owner
    await step.run('assign-creator-role', async () => {
      logger.info(`Assigning Owner role to creator: ${userId}`);

      const ownerRole = await prisma.teamRole.findFirst({
        where: {
          teamId: team.id,
          roleName: 'Owner',
        },
      });

      if (!ownerRole) {
        throw new Error('Owner role not found');
      }

      // Create team user role
      await prisma.teamUserRole.create({
        data: {
          userId,
          teamId: team.id,
          roleId: ownerRole.id,
        },
      });

      // Create team membership
      await prisma.userTeam.create({
        data: {
          userId,
          teamId: team.id,
        },
      });
    });

    // Step 5: Create audit log
    await step.run('create-audit-log', async () => {
      logger.info(`Creating audit log for team creation: ${team.id}`);

      return await prisma.teamAuditLog.create({
        data: {
          teamId: team.id,
          userId,
          action: 'TEAM_CREATED',
          level: 'INFO',
        },
      });
    });

    // Step 6: Invalidate cache
    await step.run('invalidate-cache', async () => {
      logger.info(`Invalidating cache for organization: ${organizationSlug}`);

      const cachePattern = `org:${organizationSlug}:teams:*`;
      const orgKeys = await redis.keys(cachePattern);

      if (orgKeys.length > 0) {
        await redis.del(...orgKeys);
      }

      // Invalidate team roles cache
      await redis.del(`team:roles:${team.id}`);

      // Also invalidate user teams cache
      await redis.del(`${REDIS_KEYS.USER_TEAMS}${userId}`);
    });

    logger.info(`Team created successfully: ${team.id}`);

    return {
      success: true,
      teamId: team.id,
      teamName: team.name,
      teamSlug: team.slug,
    };
  },
);

/**
 * Inngest function to handle team updates asynchronously
 */
export const updateTeamFunction = inngest.createFunction(
  { id: 'team-update', name: 'Update Team' },
  { event: 'team/update' },
  async ({ event, step }) => {
    const { userId, teamId, organizationSlug, teamSlug, updateData } = event.data;

    // Step 1: Update team
    const team = await step.run('update-team', async () => {
      logger.info(`Updating team: ${teamId}`);

      const teamData = { ...updateData };
      delete teamData.description;
      delete teamData.website;
      delete teamData.logoUrl;
      delete teamData.location;

      return await prisma.team.update({
        where: { id: teamId },
        data: teamData,
      });
    });

    // Step 2: Update team profile if profile data provided
    const profileData = {
      description: updateData.description,
      website: updateData.website,
      logoUrl: updateData.logoUrl,
      location: updateData.location,
    };

    const hasProfileData = Object.values(profileData).some((val) => val !== undefined);

    if (hasProfileData) {
      await step.run('update-team-profile', async () => {
        logger.info(`Updating profile for team: ${teamId}`);

        // Remove undefined values
        const cleanProfileData = Object.fromEntries(
          Object.entries(profileData).filter(([_, v]) => v !== undefined),
        );

        return await prisma.teamProfile.upsert({
          where: { teamId },
          update: cleanProfileData,
          create: {
            teamId,
            ...cleanProfileData,
          },
        });
      });
    }

    // Step 3: Create audit log
    await step.run('create-audit-log', async () => {
      logger.info(`Creating audit log for team update: ${teamId}`);

      return await prisma.teamAuditLog.create({
        data: {
          teamId,
          userId,
          action: 'TEAM_UPDATED',
          level: 'INFO',
        },
      });
    });

    // Step 4: Invalidate cache
    await step.run('invalidate-cache', async () => {
      logger.info(`Invalidating cache for team: ${teamSlug}`);

      // Invalidate organization teams cache
      const orgCachePattern = `org:${organizationSlug}:teams:*`;
      const orgKeys = await redis.keys(orgCachePattern);

      if (orgKeys.length > 0) {
        await redis.del(...orgKeys);
      }

      // Invalidate cache for all team members
      const teamMembers = await prisma.teamUserRole.findMany({
        where: { teamId },
        select: { userId: true },
      });

      for (const member of teamMembers) {
        await redis.del(`${REDIS_KEYS.USER_TEAMS}${member.userId}`);
      }
    });

    logger.info(`Team updated successfully: ${teamId}`);

    return {
      success: true,
      teamId: team.id,
      teamName: team.name,
    };
  },
);

/**
 * Inngest function to handle team deletion asynchronously
 */
export const deleteTeamFunction = inngest.createFunction(
  { id: 'team-delete', name: 'Delete Team' },
  { event: 'team/delete' },
  async ({ event, step }) => {
    const { userId, teamId, organizationSlug, teamSlug, teamName } = event.data;

    // Step 1: Create audit log before deletion
    await step.run('create-audit-log', async () => {
      logger.info(`Creating audit log for team deletion: ${teamId}`);

      return await prisma.teamAuditLog.create({
        data: {
          teamId,
          userId,
          action: 'TEAM_DELETED',
          level: 'WARN',
        },
      });
    });

    // Step 2: Get team members for cache invalidation
    const teamMembers = await step.run('get-team-members', async () => {
      return await prisma.teamUserRole.findMany({
        where: { teamId },
        select: { userId: true },
      });
    });

    // Step 3: Delete team (cascade will handle related records)
    await step.run('delete-team', async () => {
      logger.info(`Deleting team: ${teamId}`);

      return await prisma.team.delete({
        where: { id: teamId },
      });
    });

    // Step 4: Invalidate cache
    await step.run('invalidate-cache', async () => {
      logger.info(`Invalidating cache for deleted team: ${teamSlug}`);

      // Invalidate organization teams cache
      const orgCachePattern = `org:${organizationSlug}:teams:*`;
      const orgKeys = await redis.keys(orgCachePattern);

      if (orgKeys.length > 0) {
        await redis.del(...orgKeys);
      }

      // Invalidate all team members cache
      for (const member of teamMembers) {
        const memberKeys = await redis.keys(`user:teams:${member.userId}`);
        if (memberKeys.length > 0) {
          await redis.del(...memberKeys);
        }
      }
    });

    logger.info(`Team deleted successfully: ${teamId}`);

    return {
      success: true,
      teamId,
      teamName,
    };
  },
);
