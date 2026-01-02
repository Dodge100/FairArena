import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../config/database.js';
import { inngest } from '../../../inngest/v1/client.js';
import { parseTeamInviteCSV, validateCSVFormat } from '../../../utils/csvParser.js';
import logger from '../../../utils/logger.js';

// Validation schemas
const singleInviteSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .regex(
      /^[^+=.#]+@/,
      'Email subaddresses and special characters (+, =, ., #) are not allowed in the local part',
    ),
  roleId: z.string().min(1, 'Role ID is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  expiresInDays: z.number().min(1).max(30).default(7),
});

const bulkInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z
          .string()
          .email()
          .regex(
            /^[^+=.#]+@/,
            'Email subaddresses and special characters (+, =, ., #) are not allowed',
          ),
        roleId: z.string().min(1),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }),
    )
    .min(1)
    .max(100), // Limit to 100 invites at once
  expiresInDays: z.number().min(1).max(30).default(7),
});

const jsonBulkInviteSchema = z.object({
  jsonContent: z.string().min(1, 'JSON content is required'),
  expiresInDays: z.number().min(1).max(30).default(7),
});

interface BulkInviteInput {
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}

function parseJSONInvites(jsonContent: string): { valid: BulkInviteInput[]; invalid: any[] } {
  try {
    const parsed = JSON.parse(jsonContent);
    const invites = Array.isArray(parsed) ? parsed : parsed.invites || [];

    const valid: BulkInviteInput[] = [];
    const invalid: any[] = [];

    invites.forEach((item: any, index: number) => {
      const result = z
        .object({
          email: z
            .string()
            .email()
            .regex(
              /^[^+=.#]+@/,
              'Email subaddresses and special characters (+, =, ., #) are not allowed',
            ),
          roleId: z.string().min(1),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        })
        .safeParse(item);

      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push({ row: index + 1, data: item, errors: result.error.issues });
      }
    });

    return { valid, invalid };
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
}

/**
 * Send a single team invitation
 */
export const sendTeamInvite = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validationResult = singleInviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { email, roleId, firstName, lastName, expiresInDays } = validationResult.data;

    // Get organization and team
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const team = await prisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: teamSlug,
        },
      },
      select: { id: true, name: true, organizationId: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check user permissions (must have team.invite permission)
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.invite) {
      return res.status(403).json({ error: 'You do not have permission to invite members' });
    }

    // Verify role exists and belongs to this team
    const role = await prisma.teamRole.findUnique({
      where: { id: roleId },
      select: { id: true, roleName: true, teamId: true },
    });

    if (!role || role.teamId !== team.id) {
      return res.status(400).json({ error: 'Invalid role for this team' });
    }

    // Get inviter information
    const inviter = await prisma.user.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const inviterName =
      inviter?.firstName && inviter?.lastName
        ? `${inviter.firstName} ${inviter.lastName}`
        : inviter?.email || 'A team member';

    // Process invitation asynchronously via Inngest
    await inngest.send({
      name: 'team/invite.process-single',
      data: {
        teamId: team.id,
        organizationId: organization.id,
        teamName: team.name,
        organizationName: organization.name,
        email,
        roleId: role.id,
        roleName: role.roleName,
        firstName,
        lastName,
        expiresInDays,
        inviterId: userId,
        inviterName,
      },
    });

    logger.info('Team invitation queued for processing', {
      teamId: team.id,
      email,
      roleId: role.id,
      userId,
    });

    res.status(202).json({
      message: 'Invitation is being processed and will be sent shortly',
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error sending team invitation', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send bulk team invitations
 */
export const sendBulkTeamInvites = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validationResult = bulkInviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { invites, expiresInDays } = validationResult.data;

    // Get organization and team
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, name: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const team = await prisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: teamSlug,
        },
      },
      select: { id: true, name: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check user permissions
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.invite) {
      return res.status(403).json({ error: 'You do not have permission to invite members' });
    }

    // Validate all role IDs exist and belong to this team
    const uniqueRoleIds = [...new Set(invites.map((inv) => inv.roleId))];
    const roles = await prisma.teamRole.findMany({
      where: {
        id: { in: uniqueRoleIds },
        teamId: team.id,
      },
      select: { id: true, roleName: true },
    });

    if (roles.length !== uniqueRoleIds.length) {
      const foundRoleIds = new Set(roles.map((r) => r.id));
      const invalidRoleIds = uniqueRoleIds.filter((id) => !foundRoleIds.has(id));
      return res.status(400).json({
        error: 'Invalid role IDs provided',
        invalidRoleIds,
      });
    }

    // Create role ID to name mapping
    const roleMap = new Map(roles.map((r) => [r.id, r.roleName]));

    // Enrich invites with role names
    const enrichedInvites = invites.map((inv) => ({
      ...inv,
      roleName: roleMap.get(inv.roleId) || '',
    }));

    // Get inviter information
    const inviter = await prisma.user.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const inviterName =
      inviter?.firstName && inviter?.lastName
        ? `${inviter.firstName} ${inviter.lastName}`
        : inviter?.email || 'A team member';

    // Process bulk invitations asynchronously via Inngest
    await inngest.send({
      name: 'team/invite.process-bulk',
      data: {
        teamId: team.id,
        organizationId: organization.id,
        teamName: team.name,
        organizationName: organization.name,
        invites: enrichedInvites,
        expiresInDays,
        inviterId: userId,
        inviterName,
      },
    });

    logger.info('Bulk team invitations queued for processing', {
      teamId: team.id,
      count: invites.length,
      userId,
    });

    res.status(202).json({
      message: 'Bulk invitations are being processed and will be sent shortly',
      summary: {
        total: invites.length,
        queued: invites.length,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error processing bulk team invitations', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload CSV file for bulk team invitations
 */
export const uploadTeamInviteCSV = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { csvContent, expiresInDays = 7 } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    // Security: Check CSV size (1MB limit)
    if (csvContent.length > 1024 * 1024) {
      return res.status(400).json({
        error: 'CSV file too large. Maximum size is 1MB',
      });
    }

    // Validate CSV format
    const formatValidation = validateCSVFormat(csvContent);
    if (!formatValidation.valid) {
      return res.status(400).json({ error: formatValidation.error });
    }

    // Parse CSV
    const parseResult = parseTeamInviteCSV(csvContent);

    if (parseResult.valid.length === 0) {
      return res.status(400).json({
        error: 'No valid invitations found in CSV',
        invalidRows: parseResult.invalid,
      });
    }

    if (parseResult.valid.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 invitations allowed per CSV upload',
      });
    }

    // Check permissions
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.invite) {
      return res.status(403).json({ error: 'You do not have permission to invite members' });
    }

    // Process the valid invites using bulk invite logic
    req.body = {
      invites: parseResult.valid,
      expiresInDays,
    };

    // Call the bulk invite handler
    return sendBulkTeamInvites(req, res);
  } catch (error) {
    const err = error as Error;
    logger.error('Error processing CSV upload', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload JSON file for bulk team invitations
 */
export const uploadTeamInviteJSON = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validationResult = jsonBulkInviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { jsonContent, expiresInDays } = validationResult.data;

    // Security: Check JSON size (1MB limit)
    if (jsonContent.length > 1024 * 1024) {
      return res.status(400).json({
        error: 'JSON file too large. Maximum size is 1MB',
      });
    }

    // Parse JSON
    let parseResult;
    try {
      parseResult = parseJSONInvites(jsonContent);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid JSON format',
        details: error instanceof Error ? error.message : 'Failed to parse JSON',
      });
    }

    if (parseResult.valid.length === 0) {
      return res.status(400).json({
        error: 'No valid invitations found in JSON',
        invalidRows: parseResult.invalid,
      });
    }

    if (parseResult.valid.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 invitations allowed per JSON upload',
      });
    }

    // Check permissions
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.invite) {
      return res.status(403).json({ error: 'You do not have permission to invite members' });
    }

    // Process the valid invites using bulk invite logic
    req.body = {
      invites: parseResult.valid,
      expiresInDays,
    };

    // Return validation summary with option to proceed
    return res.status(200).json({
      message: 'JSON parsed successfully',
      summary: {
        total: parseResult.valid.length + parseResult.invalid.length,
        valid: parseResult.valid.length,
        invalid: parseResult.invalid.length,
      },
      validInvites: parseResult.valid,
      invalidInvites: parseResult.invalid,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error processing JSON upload', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get team invitations (pending, accepted, expired)
 */
export const getTeamInvitations = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug } = req.params;
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get organization and team
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const team = await prisma.team.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: teamSlug,
        },
      },
      select: { id: true },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.view) {
      return res.status(403).json({ error: 'You do not have permission to view invitations' });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause based on status
    let whereClause: any = { teamId: team.id };

    if (status === 'pending') {
      whereClause.used = false;
      whereClause.expiresAt = { gt: new Date() };
    } else if (status === 'used') {
      whereClause.used = true;
    } else if (status === 'expired') {
      whereClause.used = false;
      whereClause.expiresAt = { lte: new Date() };
    }

    const [invitations, totalCount] = await Promise.all([
      prisma.inviteCode.findMany({
        where: whereClause,
        include: {
          role: {
            select: {
              roleName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum,
      }),
      prisma.inviteCode.count({
        where: whereClause,
      }),
    ]);

    res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        roleName: inv.role.roleName,
        used: inv.used,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching team invitations', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Cancel/revoke a team invitation
 */
export const revokeTeamInvitation = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { teamSlug, organizationSlug, inviteId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the invitation
    const invitation = await prisma.inviteCode.findUnique({
      where: { id: inviteId },
      include: {
        team: {
          select: {
            id: true,
            slug: true,
            organizationId: true,
            organization: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify team and organization match
    if (
      invitation.team.slug !== teamSlug ||
      invitation.team.organization.slug !== organizationSlug
    ) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check permissions
    const teamContext = (req as any).teamContext;
    if (!teamContext?.permissions?.members?.invite) {
      return res.status(403).json({ error: 'You do not have permission to revoke invitations' });
    }

    // Check if already used
    if (invitation.used) {
      return res.status(400).json({ error: 'Cannot revoke an invitation that has been used' });
    }

    // Delete the invitation
    await prisma.inviteCode.delete({
      where: { id: inviteId },
    });

    // Create audit log
    await inngest.send({
      name: 'team/audit-log.create',
      data: {
        teamId: invitation.team.id,
        userId,
        action: 'INVITATION_REVOKED',
        level: 'INFO',
      },
    });

    logger.info('Team invitation revoked', {
      inviteId,
      teamId: invitation.team.id,
      userId,
    });

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('Error revoking team invitation', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
