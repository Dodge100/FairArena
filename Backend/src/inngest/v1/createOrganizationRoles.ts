import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const createOrganizationRoles = inngest.createFunction(
  { id: 'create-organization-roles' },
  { event: 'organization.created' },
  async ({ event, step }) => {
    const { organizationId, creatorId } = event.data;

    if (!organizationId || !creatorId) {
      logger.error('Missing required fields in organization.created event', {
        organizationId,
        creatorId,
      });
      throw new Error('organizationId and creatorId are required');
    }

    logger.info('Starting organization roles creation', { organizationId, creatorId });

    // Create default roles like GitHub organization (Owner and Member primarily, with additional roles)
    await step.run('create-roles', async () => {
      try {
        const rolesData = [
          {
            roleName: 'Owner',
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: true,
              canInvite: true,
              canManageRoles: true,
              canManageTeams: true,
              canManageProjects: true,
              canDeleteOrganization: true,
            },
          },
          {
            roleName: 'Co-Owner',
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: true,
              canInvite: true,
              canManageRoles: true,
              canManageTeams: true,
              canManageProjects: true,
              canDeleteOrganization: false,
            },
          },
          {
            roleName: 'Maintainer',
            permissions: {
              canView: true,
              canEdit: true,
              canDelete: false,
              canInvite: true,
              canManageRoles: false,
              canManageTeams: true,
              canManageProjects: true,
              canDeleteOrganization: false,
            },
          },
          {
            roleName: 'Member',
            permissions: {
              canView: true,
              canEdit: false,
              canDelete: false,
              canInvite: false,
              canManageRoles: false,
              canManageTeams: false,
              canManageProjects: false,
              canDeleteOrganization: false,
            },
          },
        ];

        const rolePromises = rolesData.map((roleData) =>
          prisma.organizationRole.create({
            data: {
              organizationId,
              ...roleData,
            },
          }),
        );

        const roles = await Promise.all(rolePromises);
        logger.info('Roles created', { roleIds: roles.map((r) => r.id) });

        // Assign owner role to creator
        const ownerRole = roles.find((r) => r.roleName === 'Owner');
        if (ownerRole) {
          await prisma.organizationUserRole.create({
            data: {
              userId: creatorId,
              organizationId,
              roleId: ownerRole.id,
            },
          });
          logger.info('Owner role assigned to creator', {
            userId: creatorId,
            roleId: ownerRole.id,
          });
        }
      } catch (error) {
        logger.error('Error creating roles or assigning owner', {
          organizationId,
          creatorId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  },
);
