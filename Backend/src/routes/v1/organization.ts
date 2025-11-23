import { Router } from 'express';
import { CreateOrganization } from '../../controllers/v1/organization/createOrganizationController.js';
import { DeleteOrganization } from '../../controllers/v1/organization/deleteOrganizationController.js';
import { GetOrganizationDetails } from '../../controllers/v1/organization/getOrganizationDetailsController.js';
import { GetOrganizationMembers } from '../../controllers/v1/organization/getOrganizationMembersController.js';
import { GetOrganizationTeams } from '../../controllers/v1/organization/getOrganizationTeamsController.js';
import { GetUserOrganizations } from '../../controllers/v1/organization/getUserOrganizationsController.js';
import { UpdateOrganizationSettings } from '../../controllers/v1/organization/updateOrganizationSettingsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', protectRoute, GetUserOrganizations);
router.post('/create/new', protectRoute, CreateOrganization);
router.get('/:slug', protectRoute, GetOrganizationDetails);
router.get('/:slug/teams', protectRoute, GetOrganizationTeams);
router.get('/:slug/members', protectRoute, GetOrganizationMembers);
router.put('/:slug/settings', protectRoute, UpdateOrganizationSettings);
router.delete('/:slug', protectRoute, DeleteOrganization);

export default router;
