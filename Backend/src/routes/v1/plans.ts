import { Router } from 'express';
import { getAllPlans, getPlanByPlanId } from '../../controllers/v1/plansController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/plans:
 *   get:
 *     summary: Get all active plans
 *     description: Retrieve a list of all active pricing plans available on the platform. This endpoint is publicly accessible and returns cached data when available.
 *     tags: [Plans]
 *     security: []
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 *                 cached:
 *                   type: boolean
 *                   description: Whether the data was served from cache
 *                   example: true
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', getAllPlans);

/**
 * @swagger
 * /api/v1/plans/{planId}:
 *   get:
 *     summary: Get plan by ID
 *     description: Retrieve details of a specific pricing plan by its plan ID. This endpoint is publicly accessible and returns cached data when available.
 *     tags: [Plans]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/PlanIdParam'
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 plan:
 *                   $ref: '#/components/schemas/Plan'
 *                 cached:
 *                   type: boolean
 *                   description: Whether the data was served from cache
 *                   example: true
 *       400:
 *         description: Plan ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Plan ID is required"
 *       404:
 *         description: Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Plan not found"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:planId', getPlanByPlanId);

export default router;
