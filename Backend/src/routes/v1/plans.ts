import { Router } from 'express';
import { getAllPlans, getPlanByPlanId } from '../../controllers/v1/plansController.js';

const router = Router();

// Public routes - no authentication needed for viewing plans
router.get('/', getAllPlans);
router.get('/:planId', getPlanByPlanId);

export default router;
