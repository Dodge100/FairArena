import express from 'express';
import { getLastUpdated } from '../../controllers/v1/githubController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/github/last-updated
 * @desc    Get last updated date from GitHub repository
 * @access  Public
 */
router.get('/last-updated', getLastUpdated);

export default router;
