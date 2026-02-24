import express from 'express';
import { getLastUpdated } from '../../controllers/v1/githubController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/github/last-updated:
 *   get:
 *     summary: Get last updated date from GitHub repository
 *     description: Retrieve the timestamp of the last update to the specified GitHub repository.
 *     tags: [GitHub]
 *     responses:
 *       200:
 *         description: Last updated timestamp retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 */
router.get('/last-updated', getLastUpdated);

export default router;
