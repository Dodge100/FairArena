import { Router } from 'express';
import { CreateOrganization } from '../../controllers/v1/organization/createOrganizationController.js';
import { DeleteOrganization } from '../../controllers/v1/organization/deleteOrganizationController.js';
import { GetOrganizationAuditLogs } from '../../controllers/v1/organization/getOrganizationAuditLogsController.js';
import { GetOrganizationDetails } from '../../controllers/v1/organization/getOrganizationDetailsController.js';
import { GetOrganizationMembers } from '../../controllers/v1/organization/getOrganizationMembersController.js';
import { GetOrganizationTeams } from '../../controllers/v1/organization/getOrganizationTeamsController.js';
import { GetUserOrganizations } from '../../controllers/v1/organization/getUserOrganizationsController.js';
import { UpdateOrganizationSettings } from '../../controllers/v1/organization/updateOrganizationSettingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import {
    loadOrganizationPermissions,
    requirePermission,
} from '../../middleware/organizationPermissions.middleware.js';
import { rateLimiters } from '../../middleware/organizationRateLimit.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/organization:
 *   get:
 *     summary: Get user's organizations
 *     description: Retrieve all organizations that the authenticated user is a member of
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', protectRoute, rateLimiters.readOrganization, GetUserOrganizations);

/**
 * @swagger
 * /api/v1/organization/create/new:
 *   post:
 *     summary: Create new organization
 *     description: Create a new organization with the authenticated user as owner
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 description: Organization name
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *                 description: Unique URL-friendly identifier
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               website:
 *                 type: string
 *                 format: uri
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *           examples:
 *             createOrganization:
 *               value:
 *                 name: "Acme Corporation"
 *                 slug: "acme-corp"
 *                 description: "Building amazing products"
 *                 website: "https://acme.com"
 *                 isPublic: true
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization created successfully"
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Organization slug already exists
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/create/new', protectRoute, rateLimiters.createOrganization, CreateOrganization);

/**
 * @swagger
 * /api/v1/organization/{slug}:
 *   get:
 *     summary: Get organization details
 *     description: Retrieve detailed information about a specific organization
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/OrganizationSlugParam'
 *     responses:
 *       200:
 *         description: Organization details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   delete:
 *     summary: Delete organization
 *     description: Delete an organization (requires owner role)
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/OrganizationSlugParam'
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:slug', protectRoute, rateLimiters.readOrganization, GetOrganizationDetails);
router.delete(
    '/:slug',
    protectRoute,
    rateLimiters.deleteOrganization,
    loadOrganizationPermissions,
    requirePermission('organization', 'delete'),
    DeleteOrganization,
);

/**
 * @swagger
 * /api/v1/organization/{slug}/teams:
 *   get:
 *     summary: Get organization teams
 *     description: Retrieve all teams within an organization
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/OrganizationSlugParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Teams retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       memberCount:
 *                         type: integer
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:slug/teams',
    protectRoute,
    rateLimiters.readOrganization,
    loadOrganizationPermissions,
    requirePermission('teams', 'view'),
    GetOrganizationTeams,
);

/**
 * @swagger
 * /api/v1/organization/{slug}/members:
 *   get:
 *     summary: Get organization members
 *     description: Retrieve all members of an organization
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/OrganizationSlugParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       user:
 *                         $ref: '#/components/schemas/Profile'
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member]
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:slug/members',
    protectRoute,
    rateLimiters.readOrganization,
    loadOrganizationPermissions,
    requirePermission('members', 'view'),
    GetOrganizationMembers,
);

/**
 * @swagger
 * /api/v1/organization/{slug}/settings:
 *   put:
 *     summary: Update organization settings
 *     description: Update organization settings (requires admin or owner role)
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/OrganizationSlugParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               website:
 *                 type: string
 *                 format: uri
 *               isPublic:
 *                 type: boolean
 *           examples:
 *             updateSettings:
 *               value:
 *                 name: "Acme Corporation"
 *                 description: "Updated description"
 *                 website: "https://newacme.com"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settings updated successfully"
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
    '/:slug/settings',
    protectRoute,
    rateLimiters.updateOrganization,
    loadOrganizationPermissions,
    requirePermission('organization', 'edit'),
    UpdateOrganizationSettings,
);

/**
 * @swagger
 * /api/v1/organization/{slug}/audit-logs:
 *   get:
 *     summary: Get organization audit logs
 *     description: Retrieve audit logs for an organization (requires audit.view permission)
 *     tags: [Organization]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of logs per page
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auditLogs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       action:
 *                         type: string
 *                       level:
 *                         type: string
 *                       details:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                       user:
 *                         type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:slug/audit-logs',
    protectRoute,
    rateLimiters.auditLogs,
    loadOrganizationPermissions,
    requirePermission('audit', 'view'),
    GetOrganizationAuditLogs,
);

export default router;
