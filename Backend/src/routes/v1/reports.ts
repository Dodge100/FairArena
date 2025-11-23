import { Router } from 'express';
import { CreateReport, GetUserReports } from '../../controllers/v1/reportsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// GET /api/v1/reports - Get user's reports
router.get('/', protectRoute, GetUserReports);

// POST /api/v1/reports - Create a new report
router.post('/', protectRoute, CreateReport);

export default router;
