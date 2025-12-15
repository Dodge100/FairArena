import { Router } from 'express';
import { cleanupExpiredData } from '../../controllers/v1/cleanupController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/cleanup:
 *   get:
 *     summary: Cleanup expired data
 *     description: Cleanup expired data from the database (cron job endpoint)
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cleanup completed successfully"
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: integer
 *                     tokens:
 *                       type: integer
 *                     notifications:
 *                       type: integer
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/cleanup', cleanupExpiredData);

export default router;
