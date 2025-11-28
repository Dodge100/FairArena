import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';

export const cleanupExpiredData = async (req: Request, res: Response) => {
  try {
    // Calculate dates
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Delete expired OTPs
    const deletedOtps = await prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: fiveDaysAgo,
        },
      },
    });

    // Delete old logs
    const deletedLogs = await prisma.logs.deleteMany({
      where: {
        createdAt: {
          lt: sixtyDaysAgo,
        },
      },
    });

    res.status(200).json({
      message: 'Cleanup completed',
      deletedOtps: deletedOtps.count,
      deletedLogs: deletedLogs.count,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
