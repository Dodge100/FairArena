import { Request, Response } from 'express';
import { z } from 'zod';
import { redeemCoupon } from '../../services/v1/couponService.js';
import logger from '../../utils/logger.js';

const redeemCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(50, 'Invalid coupon code'),
});

export const handleRedeemCoupon = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const validation = redeemCouponSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: validation.error.format(),
      });
    }

    const { code } = validation.data;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await redeemCoupon(userId, code, ipAddress, userAgent);

    return res.status(200).json({
      success: true,
      message: 'Coupon redeemed successfully!',
      data: result,
    });
  } catch (error) {
    logger.error('Redeem coupon error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId,
    });

    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to redeem coupon',
    });
  }
};
