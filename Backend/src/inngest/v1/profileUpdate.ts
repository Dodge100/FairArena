import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Validation schema (same as in profileController.ts)
const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  yearsOfExperience: z.number().int().min(0).max(100).optional(),
  experiences: z.array(z.string().max(500)).max(20).optional(),
  education: z.array(z.string().max(500)).max(20).optional(),
  skills: z.array(z.string().max(100)).max(100).optional(),
  languages: z.array(z.string().max(50)).max(50).optional(),
  interests: z.array(z.string().max(100)).max(50).optional(),
  certifications: z.array(z.string().max(200)).max(20).optional(),
  awards: z.array(z.string().max(200)).max(20).optional(),
  githubUsername: z.string().max(100).optional(),
  twitterHandle: z.string().max(100).optional(),
  linkedInProfile: z.string().url().max(500).optional().or(z.literal('')),
  portfolioUrl: z.string().url().max(500).optional().or(z.literal('')),
  resumeUrl: z.string().url().max(500).optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
  requireAuth: z.boolean().optional(),
  trackViews: z.boolean().optional(),
});

export const updateProfileFunction = inngest.createFunction(
  {
    id: 'update-profile',
    name: 'Update User Profile',
    retries: 3,
  },
  { event: 'profile/update' },
  async ({ event, step }) => {
    const { userId, profileData } = event.data;

    // Validate profile data
    const validation = profileUpdateSchema.safeParse(profileData);
    if (!validation.success) {
      throw new Error(`Invalid profile data: ${validation.error.message}`);
    }

    const validatedData = validation.data;

    await step.run('validate-user', async () => {
      const existingUser = await prisma.user.findFirst({
        where: { userId },
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      return existingUser;
    });

    // Step 2: Update or create profile
    const profile = await step.run('upsert-profile', async () => {
      return await prisma.profile.upsert({
        where: { userId },
        update: {
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          bio: validatedData.bio,
          gender: validatedData.gender,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
          phoneNumber: validatedData.phoneNumber,
          location: validatedData.location,
          jobTitle: validatedData.jobTitle,
          company: validatedData.company,
          yearsOfExperience: validatedData.yearsOfExperience,
          experiences: validatedData.experiences,
          education: validatedData.education,
          skills: validatedData.skills,
          languages: validatedData.languages,
          interests: validatedData.interests,
          certifications: validatedData.certifications,
          awards: validatedData.awards,
          githubUsername: validatedData.githubUsername,
          twitterHandle: validatedData.twitterHandle,
          linkedInProfile: validatedData.linkedInProfile,
          resumeUrl: validatedData.resumeUrl,
          portfolioUrl: validatedData.portfolioUrl,
          isPublic: validatedData.isPublic,
          requireAuth: validatedData.requireAuth,
          trackViews: validatedData.trackViews,
        },
        create: {
          userId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          bio: validatedData.bio || '',
          gender: validatedData.gender,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
          phoneNumber: validatedData.phoneNumber,
          location: validatedData.location,
          jobTitle: validatedData.jobTitle,
          company: validatedData.company,
          yearsOfExperience: validatedData.yearsOfExperience,
          education: validatedData.education,
          skills: validatedData.skills,
          languages: validatedData.languages,
          interests: validatedData.interests,
          githubUsername: validatedData.githubUsername,
          twitterHandle: validatedData.twitterHandle,
          linkedInProfile: validatedData.linkedInProfile,
          resumeUrl: validatedData.resumeUrl,
          portfolioUrl: validatedData.portfolioUrl,
          isPublic: validatedData.isPublic,
          requireAuth: validatedData.requireAuth,
          trackViews: validatedData.trackViews,
        },
      });
    });

    // Step 3: Create audit log
    await step.run('create-audit-log', async () => {
      await prisma.logs.create({
        data: {
          userId,
          action: 'profile-update',
          level: 'INFO',
          metadata: {
            updatedFields: Object.keys(profileData),
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    // Step 4: Invalidate profile cache
    await step.run('invalidate-cache', async () => {
      try {
        const cacheKey = `${REDIS_KEYS.PROFILE_CACHE}${userId}`;
        await redis.del(cacheKey);
        logger.info(`Invalidated cache for userId: ${userId}`);
      } catch (error) {
        logger.error('Cache invalidation error:', error);
        // Don't fail the update if cache invalidation fails
      }
    });

    return {
      success: true,
      profile,
      message: 'Profile updated successfully',
    };
  },
);
