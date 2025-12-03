import type { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

export const cleanupExpiredData = async (req: Request, res: Response) => {
  const readOnlyPrisma = await getReadOnlyPrisma();
  try {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Calculate dates
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete old logs
    const deletedLogs = await prisma.logs.deleteMany({
      where: {
        createdAt: {
          lt: sixtyDaysAgo,
        },
      },
    });

    // Get users to be permanently deleted
    const usersToDelete = await readOnlyPrisma.user.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      select: { userId: true, email: true },
    });

    // Send permanent deletion emails
    for (const user of usersToDelete) {
      try {
        inngest.send({
          name: 'email.send',
          data: {
            to: user.email,
            subject: 'Your Account Has Been Permanently Deleted',
            template: 'account-permanent-deletion',
            templateData: {},
          },
        });
      } catch (emailError) {
        logger.error(`Failed to send permanent deletion email to ${user.email}:`, emailError);
      }
    }

    const deletedUsers = await prisma.user.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    res.status(200).json({
      message: 'Cleanup completed',
      deletedLogs: deletedLogs.count,
      deletedUsers: deletedUsers.count,
      deletedNotifications: deletedNotifications.count,
    });
  } catch (error) {
    logger.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
