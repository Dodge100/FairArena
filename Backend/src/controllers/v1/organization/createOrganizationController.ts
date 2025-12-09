import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { redis, REDIS_KEYS } from '../../../config/redis.js';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

const PERMISSIONS = {
  OWNER: {
    // Organization management
    organization: {
      view: true,
      edit: true,
      delete: true,
      manageSettings: true,
      manageBilling: true,
      manageSecurity: true,
    },
    // Team management
    teams: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      manageMembers: true,
    },
    // Member management
    members: {
      view: true,
      invite: true,
      remove: true,
      manageRoles: true,
    },
    // Project/Repository management
    projects: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      manageSettings: true,
    },
    // Role management
    roles: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      assign: true,
    },
    // Audit/Logs
    audit: {
      view: true,
    },
  },
  CO_OWNER: {
    // Organization management
    organization: {
      view: true,
      edit: true,
      delete: false,
      manageSettings: true,
      manageBilling: false,
      manageSecurity: false,
    },
    // Team management
    teams: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      manageMembers: true,
    },
    // Member management
    members: {
      view: true,
      invite: true,
      remove: true,
      manageRoles: true,
    },
    // Project/Repository management
    projects: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      manageSettings: true,
    },
    // Role management
    roles: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      assign: true,
    },
    // Audit/Logs
    audit: {
      view: true,
    },
  },
  MAINTAINER: {
    // Organization management
    organization: {
      view: true,
      edit: false,
      delete: false,
      manageSettings: false,
      manageBilling: false,
      manageSecurity: false,
    },
    // Team management
    teams: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      manageMembers: true,
    },
    // Member management
    members: {
      view: true,
      invite: true,
      remove: false,
      manageRoles: false,
    },
    // Project/Repository management
    projects: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      manageSettings: false,
    },
    // Role management
    roles: {
      view: true,
      create: false,
      edit: false,
      delete: false,
      assign: false,
    },
    // Audit/Logs
    audit: {
      view: false,
    },
  },
  MEMBER: {
    // Organization management
    organization: {
      view: true,
      edit: false,
      delete: false,
      manageSettings: false,
      manageBilling: false,
      manageSecurity: false,
    },
    // Team management
    teams: {
      view: true,
      create: false,
      edit: false,
      delete: false,
      manageMembers: false,
    },
    // Member management
    members: {
      view: true,
      invite: false,
      remove: false,
      manageRoles: false,
    },
    // Project/Repository management
    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
      manageSettings: false,
    },
    // Role management
    roles: {
      view: false,
      create: false,
      edit: false,
      delete: false,
      assign: false,
    },
    // Audit/Logs
    audit: {
      view: false,
    },
  },
} as const;

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

      // Add user to organization
      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
        },
      });

      // Create default roles synchronously
      const rolesData = [
        {
          roleName: 'Owner',
          permissions: PERMISSIONS.OWNER,
        },
        {
          roleName: 'Co-Owner',
          permissions: PERMISSIONS.CO_OWNER,
        },
        {
          roleName: 'Maintainer',
          permissions: PERMISSIONS.MAINTAINER,
        },
        {
          roleName: 'Member',
          permissions: PERMISSIONS.MEMBER,
        },
      ];

      const roles = await Promise.all(
        rolesData.map((roleData) =>
          tx.organizationRole.create({
            data: {
              organizationId: org.id,
              ...roleData,
            },
          }),
        ),
      );

      // Assign owner role to creator
      const ownerRole = roles.find((r) => r.roleName === 'Owner');
      if (ownerRole) {
        await tx.organizationUserRole.create({
          data: {
            userId,
            organizationId: org.id,
            roleId: ownerRole.id,
          },
        });
      }

      return org;
    });

    inngest.send({
      name: 'organization.audit.create',
      data: {
        organizationId: organization.id,
        action: 'ORGANIZATION_CREATED',
        level: 'INFO',
        userId,
      },
    });

    inngest
      .send({
        name: 'log.create',
        data: {
          userId: auth.userId,
          action: 'organization_created',
          level: 'INFO',
        },
        metadata: { organizationName: organization.name },
      })
      .catch((err) => logger.error('Failed to send log event', err));

    logger.info('Organization created successfully', { organizationId: organization.id, userId });

    // Invalidate cache for user's organizations
    try {
      await redis.del(`${REDIS_KEYS.USER_ORGANIZATIONS}${userId}`);
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache after organization creation', { cacheError });
    }

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
