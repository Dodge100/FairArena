import { Router } from 'express';
import { CreateReport } from '../../controllers/v1/reportsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// POST /api/v1/reports - Create a new report
router.post('/', protectRoute, CreateReport);

export default router;
