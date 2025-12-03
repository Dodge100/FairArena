import { Router } from 'express';
import { getCreditBalance, getCreditHistory } from '../../controllers/v1/creditsController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/credits/balance:
 *   get:
 *     summary: Get credit balance
 *     description: Get the current credit balance for the authenticated user
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     responses:
 *       200:
 *         description: Credit balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: integer
 *                     userId:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/balance', protectRoute, getCreditBalance);

/**
 * @swagger
 * /api/v1/credits/history:
 *   get:
 *     summary: Get credit transaction history
 *     description: Get paginated credit transaction history for the authenticated user
 *     tags: [Credits]
 *     security:
 *       - ClerkAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transactions to skip
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PURCHASE, REFUND, BONUS, DEDUCTION, ADJUSTMENT, EXPIRY, TRANSFER_IN, TRANSFER_OUT]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Credit history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/history', protectRoute, getCreditHistory);

export default router;
