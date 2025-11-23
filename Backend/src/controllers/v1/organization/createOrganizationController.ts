import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

// Zod schema for organization creation
const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be less than 100 characters')
    .trim(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
    .toLowerCase(),
  joinEnabled: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(true),
  timezone: z.string().optional(),
});

export const CreateOrganization = async (req: Request, res: Response) => {
  const auth = req.auth();
  try {
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input with Zod
    const validationResult = createOrganizationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { name, slug, joinEnabled, isPublic, timezone } = validationResult.data;

    // Check if slug is unique
    const existingOrg = await prisma.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      // Generate and check suggestions efficiently
      const candidates = Array.from({ length: 10 }, (_, i) => `${slug}-${i + 1}`);
      const existingSuggestions = await prisma.organization.findMany({
        where: { slug: { in: candidates } },
        select: { slug: true },
      });
      const takenSlugs = new Set(existingSuggestions.map((org) => org.slug));
      const suggestion = candidates.find((cand) => !takenSlugs.has(cand));
      if (suggestion) {
        return res.status(409).json({
          error: 'Slug already exists',
          suggestion,
        });
      } else {
        return res.status(409).json({ error: 'Slug already exists and no suggestions available' });
      }
    }

    // Create organization in a transaction
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          joinEnabled,
          isPublic,
          timezone,
        },
      });

      inngest
        .send({
          name: 'organization.created',
          data: {
            organizationId: org.id,
            creatorId: userId,
          },
        })
        .catch((err) => logger.error('Failed to send Inngest event', err));

      inngest.send({
        name: 'log.create',
        data: {
          userId: auth.userId,
          action: 'organization_created',
          level: 'INFO',
        },
        metadata: { organizationName: org.name },
      });

      // Add user to organization
      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
        },
      });

      return org;
    });

    logger.info('Organization created successfully', { organizationId: organization.id, userId });

    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        joinEnabled: organization.joinEnabled,
        isPublic: organization.isPublic,
        timezone: organization.timezone,
        createdAt: organization.createdAt,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error creating organization', {
      error: err.message,
      stack: err.stack,
      userId: auth.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
