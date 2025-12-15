import { prisma } from '../../config/database.js';
import { sendDataExportEmail, sendEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

export const exportUserDataHandler = inngest.createFunction(
  {
    id: 'export-user-data',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'user/export-data' },
  async ({ event }) => {
    const { userId } = event.data;

    if (!userId) {
      logger.error('Missing userId in export-user-data event');
      throw new Error('userId is required');
    }

    try {
      logger.info('Starting user data export', { userId });

      // Send initiation notification
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'ALERT',
          title: 'Data Export Started',
          message: 'Your data export has been initiated.',
          description:
            'We are preparing your data for download. You will receive an email with your data shortly.',
          actionUrl: '/dashboard/settings',
          actionLabel: 'View Settings',
        },
      });

      // Get user basic info
      const user = await prisma.user.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          isDeleted: true,
          deletedAt: true,
        },
      });

      if (!user) {
        logger.error('User not found for data export', { userId });
        throw new Error('User not found');
      }

      // Get user profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          bio: true,
          company: true,
          dateOfBirth: true,
          education: true,
          gender: true,
          githubUsername: true,
          interests: true,
          isPublic: true,
          jobTitle: true,
          languages: true,
          linkedInProfile: true,
          location: true,
          phoneNumber: true,
          portfolioUrl: true,
          requireAuth: true,
          resumeUrl: true,
          skills: true,
          trackViews: true,
          twitterHandle: true,
          yearsOfExperience: true,
          awards: true,
          certifications: true,
          experiences: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Get user logs (last 1000 entries)
      const logs = await prisma.logs.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: {
          action: true,
          level: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Get user reports
      const reports = await prisma.report.findMany({
        where: { reporterId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reportedEntityId: true,
          entityType: true,
          reason: true,
          details: true,
          state: true,
          createdAt: true,
        },
      });

      // Get organizations user belongs to
      const userOrganizations = await prisma.userOrganization.findMany({
        where: { userId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPublic: true,
              timezone: true,
              createdAt: true,
            },
          },
        },
      });

      // Get teams user belongs to
      const userTeams = await prisma.userTeam.findMany({
        where: { userId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              visibility: true,
              timezone: true,
              createdAt: true,
              organization: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      // Get projects user belongs to
      const userProjects = await prisma.userProject.findMany({
        where: { userId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              visibility: true,
              createdAt: true,
              team: {
                select: {
                  name: true,
                  slug: true,
                  organization: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Get profile stars given/received
      const profileStarsGiven = await prisma.profileStars.findMany({
        where: { userId },
        select: {
          createdAt: true,
          profile: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const profileStarsReceived = await prisma.profileStars.findMany({
        where: {
          profile: {
            userId: userId,
          },
        },
        select: {
          createdAt: true,
          user: {
            select: {
              userId: true,
              email: true,
            },
          },
        },
      });

      // Get organization followers/following
      const organizationFollowers = await prisma.organizationFollowers.findMany({
        where: { userId },
        select: {
          createdAt: true,
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      const organizationFollowing = await prisma.organizationFollowers.findMany({
        where: {
          organization: {
            userOrganizations: {
              some: {
                userId: userId,
              },
            },
          },
        },
        include: {
          user: {
            select: {
              userId: true,
              email: true,
            },
          },
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      // Get organization stars
      const organizationStars = await prisma.organizationStars.findMany({
        where: { userId },
        include: {
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      // Get notifications
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: {
          type: true,
          title: true,
          message: true,
          read: true,
          actionUrl: true,
          actionLabel: true,
          metadata: true,
          description: true,
          createdAt: true,
          readAt: true,
        },
      });

      // Get profile views (if tracking is enabled)
      type ProfileView = {
        viewerUserId: string | null;
        viewerEmail: string | null;
        viewerName: string | null;
        createdAt: Date;
      };
      let profileViews: ProfileView[] = [];
      if (profile?.trackViews) {
        profileViews = await prisma.profileView.findMany({
          where: { profileId: profile.id },
          orderBy: { createdAt: 'desc' },
          take: 1000,
          select: {
            viewerUserId: true,
            viewerEmail: true,
            viewerName: true,
            createdAt: true,
          },
        });
      }

      // Compile all data
      const exportData = {
        exportDate: new Date().toISOString(),
        user: user,
        profile: profile,
        activity: {
          logs: logs,
          reports: reports,
          notifications: notifications,
          profileViews: profileViews,
        },
        organizations: {
          memberships: userOrganizations,
          following: organizationFollowers,
          stars: organizationStars,
        },
        teams: {
          memberships: userTeams,
        },
        projects: {
          memberships: userProjects,
        },
        social: {
          profileStarsGiven: profileStarsGiven,
          profileStarsReceived: profileStarsReceived,
          organizationFollowing: organizationFollowing,
        },
      };

      // Convert to JSON string for email attachment
      const dataJson = JSON.stringify(exportData, null, 2);

      // Send email with data
      await sendDataExportEmail(
        user.email,
        profile?.firstName || user.email.split('@')[0],
        new Date().toLocaleDateString(),
        `${(dataJson.length / 1024).toFixed(2)} KB`,
        [
          {
            filename: `fairarena-data-export-${user.userId}-${new Date().toISOString().split('T')[0]}.json`,
            content: Buffer.from(dataJson),
            contentType: 'application/json',
          },
        ],
      );

      // Send completion notification
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'SYSTEM',
          title: 'Data Export Completed',
          message: 'Your data export is ready!',
          description:
            'Check your email for the download link. The export contains all your profile data, activity logs, and account information.',
          actionUrl: '/dashboard/settings',
          actionLabel: 'View Settings',
        },
      });

      // Log the export
      inngest.send({
        name: 'log.create',
        data: {
          userId,
          action: 'data-export-completed',
          level: 'INFO',
          metadata: {
            email: user.email,
            dataSize: dataJson.length,
          },
        },
      });

      logger.info('User data export completed successfully', {
        userId,
        email: user.email,
        dataSize: dataJson.length,
      });
    } catch (error) {
      logger.error('Failed to export user data', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try to send error notification email and in-app notification
      try {
        const user = await prisma.user.findUnique({
          where: { userId },
          select: { email: true, profile: { select: { firstName: true } } },
        });

        if (user) {
          // Send error email
          await sendEmail(user.email, 'Data Export Failed', 'data-export-error', {
            userName: user.profile?.firstName || user.email.split('@')[0],
            errorMessage: 'Data export failed. Please try again later.',
          });

          // Send error notification
          await inngest.send({
            name: 'notification/send',
            data: {
              userId,
              type: 'SYSTEM',
              title: 'Data Export Failed',
              message: 'Your data export request could not be completed.',
              description:
                'An error occurred while preparing your data. Please try again or contact support if the issue persists.',
              actionUrl: '/dashboard/settings',
              actionLabel: 'Try Again',
            },
          });
        }
      } catch (emailError) {
        logger.error('Failed to send error notification email', {
          userId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }

      throw error;
    }
  },
);
