import { prisma } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export async function upsertUser(userId: string, email: string) {
  if (!userId || !email) {
    throw new Error('userId and email are required');
  }

  userId = userId.trim();
  email = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { isDeleted: true, email: true },
    });

    if (existingUser && existingUser.isDeleted) {
      await prisma.user.update({
        where: { email },
        data: {
          userId,
          isDeleted: false,
          deletedAt: null,
        },
      });

      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'SYSTEM',
          title: 'Welcome Back, Partner!',
          description: 'Your account has been successfully recovered.',
          message:
            "Great to see you back just in time! Your account was on the verge of permanent deletion, but you've saved it. Let's continue building together on FairArena.",
        },
      });

      logger.info('User account recovered', { userId, email });

      inngest.send({
        name: 'email.send',
        data: {
          to: email,
          subject: 'Your account has been recovered',
          template: 'account-recovery',
          templateData: {},
        },
      });

      inngest.send({
        name: 'log.create',
        data: {
          userId,
          action: 'Account recovered',
          level: 'INFO',
          metadata: { email },
        },
      });
    } else if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: { userId },
      });

      logger.info('User updated', { userId, email });

      inngest.send({
        name: 'log.create',
        data: {
          userId,
          action: 'user-updated',
          level: 'INFO',
          metadata: { email },
        },
      });
    } else {
      await prisma.user.create({
        data: {
          userId,
          email,
        },
      });

      // Create default settings for the new user
      await inngest.send({
        name: 'user.settings.create',
        data: { userId },
      });

      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'SYSTEM',
          title: 'Welcome to FairArena',
          description: 'We’re excited to have you on board, partner.',
          message:
            'We’re grateful to have you on board, partner. We hope you have a great journey with us!',
        },
      });

      logger.info('User created', { userId, email });

      inngest.send({
        name: 'email.send',
        data: {
          to: email,
          subject: 'Welcome to our platform',
          template: 'welcome',
          templateData: {
            userName: email.split('@')[0],
          },
        },
      });

      inngest.send({
        name: 'log.create',
        data: {
          userId,
          action: 'user-created',
          level: 'INFO',
          metadata: { email },
        },
      });
    }
  } catch (error: unknown) {
    logger.error('Error upserting user', {
      userId,
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deleteUser(userId: string) {
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    // Fetch user to get email for notification
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { email: true },
    });

    if (!user) {
      logger.warn(`User ${userId} not found in database, cannot send deletion email`);
      return;
    }

    await prisma.user.update({
      where: { userId },
      data: {
        deletedAt: new Date(),
        isDeleted: true,
      },
    });

    await inngest.send({
      name: 'notification/send',
      data: {
        userId,
        type: 'ALERT',
        title: 'Account Deletion Initiated',
        description: 'You have requested to delete your account.',
        message:
          "We're processing your account deletion request. If this was a mistake, you can still recover your account within the next 90 days. Thank you for being part of FairArena.",
      },
    });

    // Send email notification asynchronously
    try {
      inngest.send({
        name: 'email.send',
        data: {
          to: user.email,
          subject: 'Your Account Has Been Deleted',
          template: 'account-deletion-warning',
          templateData: {
            recoveryInstructions:
              'You can recover your account by signing in again with the same email.',
            deadline: '90 days',
          },
        },
      });
    } catch (emailError) {
      logger.error('Failed to send account deletion email', {
        userId,
        email: user.email,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
      // Don't throw, as user deletion should succeed even if email fails
    }

    inngest.send({
      name: 'log.create',
      data: {
        userId,
        action: 'user-deletion-process-started',
        level: 'CRITICAL',
      },
    });

    logger.info('User deletion initiation successful', { userId });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      // User not found, which is fine for deletion
      logger.warn(`User ${userId} not found in database, possibly already deleted`);
    } else {
      logger.error('Error deleting user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
