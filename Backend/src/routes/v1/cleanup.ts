import { Router } from 'express';
import { cleanupExpiredData } from '../../controllers/v1/cleanupController.js';

const router = Router();

// Cron job endpoint for cleanup
router.get('/cleanup', cleanupExpiredData);

export default router;
