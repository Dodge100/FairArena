import { Router } from 'express';
import { getPresence, heartbeat, updatePresence } from '../../controllers/v1/presenceController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @route   POST /api/v1/presence/heartbeat
 * @desc    Send presence heartbeat to keep connection alive
 * @access  Private
 */
router.post('/heartbeat', protectRoute, heartbeat);

/**
 * @route   GET /api/v1/presence/status
 * @desc    Get current user presence status
 * @access  Private
 */
router.get('/status', protectRoute, getPresence);

/**
 * @route   PUT /api/v1/presence
 * @desc    Update user presence (online/offline)
 * @access  Private
 */
router.put('/', protectRoute, updatePresence);

export default router;
