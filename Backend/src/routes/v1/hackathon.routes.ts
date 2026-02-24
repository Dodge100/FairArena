import { Router } from 'express';
import { getHackathons } from '../../controllers/v1/hackathonController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/hackathon:
 *   get:
 *     summary: Get list of hackathons
 *     description: Retrieve a list of upcoming and past hackathons.
 *     tags: [Hackathons]
 *     responses:
 *       200:
 *         description: List of hackathons retrieved successfully
 */
router.get('/', getHackathons);

export default router;
