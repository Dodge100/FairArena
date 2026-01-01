import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { inngest } from '../../../inngest/v1/client.js';

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'INTERNAL']).default('INTERNAL'),
  joinEnabled: z.boolean().default(false),
  timezone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
});

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { organizationSlug } = req.params;
    const auth = req.user;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validationResult = createTeamSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const {
      name,
      slug,
      description,
      visibility,
      joinEnabled,
      timezone,
      website,
      logoUrl,
      location,
    } = validationResult.data;

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, slug: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user has permission to create teams in this organization
    const userRole = await prisma.organizationUserRole.findFirst({
      where: {
        userId,
        organizationId: organization.id,
      },
      include: {
        role: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!userRole) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const permissions = userRole.role.permissions as { teams?: { create?: boolean } };
    if (!permissions.teams?.create) {
      return res.status(403).json({ error: 'You do not have permission to create teams' });
    }

    // Check if team with same name or slug already exists in the organization
    const existingTeam = await prisma.team.findFirst({
      where: {
        organizationId: organization.id,
        OR: [{ name }, { slug }],
      },
    });

    if (existingTeam) {
      return res.status(409).json({
        error:
          existingTeam.name === name
            ? 'Team with this name already exists'
            : 'Team with this slug already exists',
      });
    }

    // Trigger Inngest function to create team asynchronously
    const result = await inngest.send({
      name: 'team/create',
      data: {
        userId,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        name,
        slug,
        description,
        visibility,
        joinEnabled,
        timezone,
        website,
        logoUrl,
        location,
      },
    });

    return res.status(202).json({
      message: 'Team creation in progress',
      eventId: result.ids[0],
      team: {
        name,
        slug,
        organizationSlug: organization.slug,
      },
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return res.status(500).json({ error: 'Failed to create team' });
  }
};
