import { Router } from 'express';
import {
  acceptTeamInvitation,
  declineTeamInvitation,
  getInvitationDetails,
} from '../../controllers/v1/team/acceptInviteController.js';
import { createTeam } from '../../controllers/v1/team/createTeamController.js';
import {
  getTeamInvitations,
  revokeTeamInvitation,
  sendBulkTeamInvites,
  sendTeamInvite,
  uploadTeamInviteCSV,
  uploadTeamInviteJSON,
} from '../../controllers/v1/team/inviteController.js';
import {
  deleteTeam,
  getTeamDetails,
  listOrganizationTeams,
  updateTeam,
} from '../../controllers/v1/team/teamManagementController.js';
import { getTeamRoles } from '../../controllers/v1/team/teamRolesController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import {
  requireOrganizationMembership,
  requireTeamMembership,
} from '../../middleware/membership.middleware.js';
import { loadOrganizationPermissions } from '../../middleware/organizationPermissions.middleware.js';
import { teamPermissionMiddleware } from '../../middleware/team-permission.middleware.js';

const router = Router();

/**
 * @swagger
 * /team/invite/{inviteCode}:
 *   get:
 *     summary: Get invitation details (public)
 *     description: Retrieve details about a team invitation using the invite code
 *     tags: [Team Invitations]
 *     security: []
 *     parameters:
 *       - name: inviteCode
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique invitation code
 *     responses:
 *       200:
 *         description: Invitation details retrieved successfully
 *       404:
 *         description: Invalid invitation code
 *       410:
 *         description: Invitation expired or already used
 */
router.get('/invite/:inviteCode', getInvitationDetails);

/**
 * @swagger
 * /team/invite/{inviteCode}/accept:
 *   post:
 *     summary: Accept team invitation
 *     description: Accept a team invitation and join the team. User will be added to organization if not already a member.
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: inviteCode
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique invitation code
 *     responses:
 *       200:
 *         description: Successfully joined the team
 *       401:
 *         description: Unauthorized - must be logged in
 *       403:
 *         description: Email mismatch - invitation sent to different email
 *       404:
 *         description: Invalid invitation code
 *       410:
 *         description: Invitation expired or already used
 */
router.post('/invite/:inviteCode/accept', protectRoute, acceptTeamInvitation);

/**
 * @swagger
 * /team/invite/{inviteCode}/decline:
 *   post:
 *     summary: Decline team invitation
 *     description: Decline a team invitation
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: inviteCode
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique invitation code
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Email mismatch
 *       404:
 *         description: Invalid invitation code
 */
router.post('/invite/:inviteCode/decline', protectRoute, declineTeamInvitation);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/roles:
 *   get:
 *     summary: Get team roles
 *     description: Retrieve all roles for a specific team
 *     tags: [Team Roles]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team roles retrieved successfully
 *       403:
 *         description: No access to this team
 *       404:
 *         description: Team or organization not found
 */
router.get(
  '/organization/:organizationSlug/team/:teamSlug/roles',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  getTeamRoles,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites:
 *   post:
 *     summary: Send team invitation
 *     description: Send a single team invitation to a user
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - roleId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               roleId:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               expiresInDays:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 7
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid request data or user already member
 *       403:
 *         description: No permission to invite members
 *       404:
 *         description: Team or organization not found
 */
router.post(
  '/organization/:organizationSlug/team/:teamSlug/invites',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  sendTeamInvite,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites/bulk:
 *   post:
 *     summary: Send bulk team invitations
 *     description: Send multiple team invitations at once (max 100)
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invites
 *             properties:
 *               invites:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                     - roleId
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                     roleId:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *               expiresInDays:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 7
 *     responses:
 *       200:
 *         description: Bulk invitations processed
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: No permission to invite members
 */
router.post(
  '/organization/:organizationSlug/team/:teamSlug/invites/bulk',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  sendBulkTeamInvites,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites/csv:
 *   post:
 *     summary: Upload CSV for bulk invitations
 *     description: Upload a CSV file to send bulk team invitations (max 100)
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csvContent
 *             properties:
 *               csvContent:
 *                 type: string
 *                 description: CSV content with columns email,roleId,firstName,lastName
 *               expiresInDays:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 7
 *     responses:
 *       200:
 *         description: CSV processed and invitations sent
 *       400:
 *         description: Invalid CSV format or data
 *       403:
 *         description: No permission to invite members
 */
router.post(
  '/organization/:organizationSlug/team/:teamSlug/invites/csv',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  uploadTeamInviteCSV,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites/json:
 *   post:
 *     summary: Upload JSON file for bulk team invitations
 *     description: Parse and validate JSON file containing bulk team member invitations. Returns validation summary.
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jsonContent
 *             properties:
 *               jsonContent:
 *                 type: string
 *                 description: Stringified JSON array or object with invites array
 *                 example: '[{"email":"user@example.com","roleId":"role-id","firstName":"John","lastName":"Doe"}]'
 *               expiresInDays:
 *                 type: number
 *                 default: 7
 *                 minimum: 1
 *                 maximum: 30
 *     responses:
 *       200:
 *         description: JSON parsed successfully with validation summary
 *       400:
 *         description: Invalid JSON format or data
 *       403:
 *         description: No permission to invite members
 */
router.post(
  '/organization/:organizationSlug/team/:teamSlug/invites/json',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  uploadTeamInviteJSON,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites:
 *   get:
 *     summary: Get team invitations
 *     description: Retrieve list of team invitations (pending, used, or expired)
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, used, expired]
 *           default: pending
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *       403:
 *         description: No permission to view invitations
 */
router.get(
  '/organization/:organizationSlug/team/:teamSlug/invites',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  getTeamInvitations,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}/invites/{inviteId}:
 *   delete:
 *     summary: Revoke team invitation
 *     description: Revoke/cancel a pending team invitation
 *     tags: [Team Invitations]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: inviteId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation revoked successfully
 *       400:
 *         description: Cannot revoke used invitation
 *       403:
 *         description: No permission to revoke invitations
 *       404:
 *         description: Invitation not found
 */
router.delete(
  '/organization/:organizationSlug/team/:teamSlug/invites/:inviteId',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  revokeTeamInvitation,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/teams:
 *   get:
 *     summary: List all teams in an organization
 *     description: Get all teams that the user has access to in the organization
 *     tags: [Teams]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *     responses:
 *       200:
 *         description: List of teams retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a member of the organization
 *       404:
 *         description: Organization not found
 *   post:
 *     summary: Create a new team
 *     description: Create a new team in the organization with default roles
 *     tags: [Teams]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
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
 *                 minLength: 2
 *                 maxLength: 100
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, INTERNAL]
 *                 default: INTERNAL
 *               joinEnabled:
 *                 type: boolean
 *                 default: false
 *               timezone:
 *                 type: string
 *               website:
 *                 type: string
 *                 format: uri
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *               location:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       202:
 *         description: Team creation in progress
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No permission to create teams
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Team with same name or slug already exists
 */
router.get(
  '/organization/:organizationSlug/teams',
  protectRoute,
  requireOrganizationMembership,
  listOrganizationTeams,
);
router.post(
  '/organization/:organizationSlug/teams',
  protectRoute,
  requireOrganizationMembership,
  loadOrganizationPermissions,
  createTeam,
);

/**
 * @swagger
 * /team/organization/{organizationSlug}/team/{teamSlug}:
 *   get:
 *     summary: Get team details
 *     description: Retrieve detailed information about a specific team
 *     tags: [Teams]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team slug
 *     responses:
 *       200:
 *         description: Team details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No access to this team
 *       404:
 *         description: Team not found
 *   put:
 *     summary: Update team
 *     description: Update team information and profile
 *     tags: [Teams]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team slug
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, INTERNAL]
 *               joinEnabled:
 *                 type: boolean
 *               timezone:
 *                 type: string
 *               website:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       202:
 *         description: Team update in progress
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No permission to update team
 *       404:
 *         description: Team not found
 *       409:
 *         description: Team with same name or slug already exists
 *   delete:
 *     summary: Delete team
 *     description: Delete a team (must have no members or projects)
 *     tags: [Teams]
 *     parameters:
 *       - name: organizationSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *       - name: teamSlug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team slug
 *     responses:
 *       202:
 *         description: Team deletion in progress
 *       400:
 *         description: Team has members or projects
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No permission to delete team
 *       404:
 *         description: Team not found
 */
router.get(
  '/organization/:organizationSlug/team/:teamSlug',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  getTeamDetails,
);
router.put(
  '/organization/:organizationSlug/team/:teamSlug',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  updateTeam,
);
router.delete(
  '/organization/:organizationSlug/team/:teamSlug',
  protectRoute,
  requireOrganizationMembership,
  requireTeamMembership,
  teamPermissionMiddleware,
  deleteTeam,
);

export default router;
