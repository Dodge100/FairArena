import { Router } from 'express';
import { inviteToPlatform } from '../../controllers/v1/platformInviteController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/invite', protectRoute, inviteToPlatform);

export default router;
