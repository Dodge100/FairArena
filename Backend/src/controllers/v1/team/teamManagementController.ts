import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import { inngest } from '../../../inngest/v1/client.js';

const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'INTERNAL']).optional(),
  joinEnabled: z.boolean().optional(),
  timezone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
});

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { organizationSlug, teamSlug } = req.params;
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Validate request body
    const validationResult = updateTeamSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const updateData = validationResult.data;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    // Use team context from middleware (already validated membership and loaded team)
    const teamContext = req.teamContext;
    if (!teamContext) {
      return res.status(500).json({ error: 'Team context not found' });
    }

    // Permission check already done by middleware
    if (!teamContext.permissions.team?.edit) {
      return res.status(403).json({ error: 'You do not have permission to update this team' });
    }

    // Check if new name or slug conflicts with existing team
    if (updateData.name || updateData.slug) {
      const conflictingTeam = await prisma.team.findFirst({
        where: {
          organizationId: teamContext.organizationId,
          id: { not: teamContext.teamId },
          OR: [
            ...(updateData.name ? [{ name: updateData.name }] : []),
            ...(updateData.slug ? [{ slug: updateData.slug }] : []),
          ],
        },
      });

      if (conflictingTeam) {
        return res.status(409).json({
          error:
            conflictingTeam.name === updateData.name
              ? 'Team with this name already exists'
              : 'Team with this slug already exists',
        });
      }
    }

    // Trigger Inngest function to update team asynchronously
    const result = await inngest.send({
      name: 'team/update',
      data: {
        userId,
        teamId: teamContext.teamId,
        organizationSlug,
        teamSlug,
        updateData,
      },
    });

    return res.status(202).json({
      message: 'Team update in progress',
      eventId: result.ids[0],
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return res.status(500).json({ error: 'Failed to update team' });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { organizationSlug, teamSlug } = req.params;
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Use team context from middleware (membership and permission already checked)
    const teamContext = req.teamContext;
    if (!teamContext) {
      return res.status(500).json({ error: 'Team context not found' });
    }

    // Permission check
    if (!teamContext.permissions.team?.delete) {
      return res.status(403).json({ error: 'You do not have permission to delete this team' });
    }

    // Get team details with counts
    const team = await prisma.team.findUnique({
      where: {
        id: teamContext.teamId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            teamMemberships: true,
            projects: true,
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if team has members or projects
    if (team._count.teamMemberships > 1) {
      return res.status(400).json({
        error: 'Cannot delete team with members. Please remove all members first.',
        memberCount: team._count.teamMemberships,
      });
    }

    if (team._count.projects > 0) {
      return res.status(400).json({
        error: 'Cannot delete team with projects. Please delete all projects first.',
        projectCount: team._count.projects,
      });
    }

    // Trigger Inngest function to delete team asynchronously
    const result = await inngest.send({
      name: 'team/delete',
      data: {
        userId,
        teamId: team.id,
        organizationSlug,
        teamSlug,
        teamName: team.name,
      },
    });

    return res.status(202).json({
      message: 'Team deletion in progress',
      eventId: result.ids[0],
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    return res.status(500).json({ error: 'Failed to delete team' });
  }
};

export const getTeamDetails = async (req: Request, res: Response) => {
  try {
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use team context from middleware (membership already validated)
    const teamContext = req.teamContext;
    if (!teamContext) {
      return res.status(500).json({ error: 'Team context not found' });
    }

    // Get team details
    const team = await prisma.team.findUnique({
      where: { id: teamContext.teamId },
      include: {
        teamProfile: true,
        _count: {
          select: {
            teamMemberships: true,
            projects: true,
            teamRoles: true,
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Middleware already validated membership, just return team details
    return res.status(200).json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        visibility: team.visibility,
        joinEnabled: team.joinEnabled,
        timezone: team.timezone,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        profile: team.teamProfile,
        stats: {
          members: team._count.teamMemberships,
          projects: team._count.projects,
          roles: team._count.teamRoles,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    return res.status(500).json({ error: 'Failed to fetch team details' });
  }
};

export const listOrganizationTeams = async (req: Request, res: Response) => {
  try {
    const { organizationSlug } = req.params;
    const auth = req.user;

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId; // Check cache first
    const cacheKey = `org:${organizationSlug}:teams:${userId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      // Upstash Redis automatically parses JSON
      return res.status(200).json(cached);
    }

    // Use organization ID from middleware cache if available
    let organizationId: string | undefined = req.organizationId;

    if (!organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true },
      });

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      organizationId = organization.id;
    }

    // Ensure organizationId is a string before using in query
    if (typeof organizationId !== 'string') {
      console.error('Invalid organizationId type:', typeof organizationId, organizationId);
      return res.status(500).json({ error: 'Invalid organization ID' });
    }

    // Get all teams user has access to
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'INTERNAL' },
          {
            teamMemberships: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        teamProfile: {
          select: {
            description: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            teamMemberships: true,
            projects: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const response = {
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        visibility: team.visibility,
        description: team.teamProfile?.description,
        logoUrl: team.teamProfile?.logoUrl,
        memberCount: team._count.teamMemberships,
        projectCount: team._count.projects,
        createdAt: team.createdAt,
      })),
    };

    // Cache for 10 minutes
    await redis.setex(cacheKey, 600, JSON.stringify(response));

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error listing teams:', error);
    return res.status(500).json({ error: 'Failed to list teams' });
  }
};
