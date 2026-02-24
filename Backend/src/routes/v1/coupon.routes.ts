import { Router } from 'express';
import { handleRedeemCoupon } from '../../controllers/v1/couponController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/coupons/redeem:
 *   post:
 *     summary: Redeem a coupon code
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Coupon redeemed successfully
 *       400:
 *         description: Invalid coupon or user not eligible
 *       401:
 *         description: Unauthorized
 */
router.post('/redeem', protectRoute, handleRedeemCoupon);

export default router;
