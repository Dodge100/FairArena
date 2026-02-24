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

import { Router } from 'express';
import { CreateOrganization } from '../../controllers/v1/organization/createOrganizationController.js';
import { DeleteOrganization } from '../../controllers/v1/organization/deleteOrganizationController.js';
import { GetOrganizationAuditLogs } from '../../controllers/v1/organization/getOrganizationAuditLogsController.js';
import { GetOrganizationDetails } from '../../controllers/v1/organization/getOrganizationDetailsController.js';
import { GetOrganizationMembers } from '../../controllers/v1/organization/getOrganizationMembersController.js';
import { GetOrganizationTeams } from '../../controllers/v1/organization/getOrganizationTeamsController.js';
import { GetUserOrganizations } from '../../controllers/v1/organization/getUserOrganizationsController.js';
import { UpdateOrganizationSettings } from '../../controllers/v1/organization/updateOrganizationSettingsController.js';
import * as ssoController from '../../controllers/v1/ssoConfigController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import {
  loadOrganizationPermissions,
  requirePermission,
} from '../../middleware/organizationPermissions.middleware.js';
import { rateLimiters } from '../../middleware/organizationRateLimit.middleware.js';

const router = Router();

// SSO Configuration
/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config:
 *   get:
 *     summary: Get SSO configuration
 *     description: Retrieve the Single Sign-On configuration for an organization.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SSO configuration retrieved successfully
 *   post:
 *     summary: Update SSO configuration
 *     description: Create or update the Single Sign-On configuration for an organization.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: SSO configuration updated successfully
 */
router.get('/:orgId/sso-config', protectRoute, ssoController.getSSOConfig);
router.post('/:orgId/sso-config', protectRoute, ssoController.upsertSSOConfig);

/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config/scim-token:
 *   post:
 *     summary: Regenerate SCIM token
 *     description: Generate a new SCIM API token for automated user provisioning.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: SCIM token regenerated successfully
 */
router.post('/:orgId/sso-config/scim-token', protectRoute, ssoController.regenerateSCIMToken);

/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config/test:
 *   post:
 *     summary: Test SSO connection
 *     description: Verify the connectivity and configuration with the identity provider.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: SSO connection test results
 */
router.post('/:orgId/sso-config/test', protectRoute, ssoController.testSSOConnection);

/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config/verification-status:
 *   get:
 *     summary: Get domain verification status
 *     description: Check the status of domain ownership verification for SSO.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Domain verification status retrieved successfully
 */
router.get(
  '/:orgId/sso-config/verification-status',
  protectRoute,
  ssoController.getVerificationStatus,
);

/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config/verify-domain/initiate:
 *   post:
 *     summary: Initiate domain verification
 *     description: Start the process of verifying a domain for SSO.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Domain verification initiated successfully
 */
router.post(
  '/:orgId/sso-config/verify-domain/initiate',
  protectRoute,
  ssoController.initiateDomainVerification,
);

/**
 * @swagger
 * /api/v1/organization/{orgId}/sso-config/verify-domain/check:
 *   post:
 *     summary: Check domain verification
 *     description: Verify if the requested domain has been correctly configured with required records.
 *     tags: [Organization SSO]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Domain verification check complete
 */
router.post(
  '/:orgId/sso-config/verify-domain/check',
  protectRoute,
  ssoController.checkDomainVerification,
);

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
