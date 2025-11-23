import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Validation schema (same as in profileController.ts)
const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).nullish(),
  lastName: z.string().min(1).max(100).nullish(),
  bio: z.string().max(1000).nullish(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullish(),
  dateOfBirth: z.string().nullish(),
  phoneNumber: z.string().max(20).nullish(),
  location: z.string().max(200).nullish(),
  jobTitle: z.string().max(200).nullish(),
  company: z.string().max(200).nullish(),
  yearsOfExperience: z.number().int().min(0).max(100).nullish(),
  experiences: z.array(z.string().max(500)).max(20).nullish(),
  education: z.array(z.string().max(500)).max(20).nullish(),
  skills: z.array(z.string().max(100)).max(100).nullish(),
  languages: z.array(z.string().max(50)).max(50).nullish(),
  interests: z.array(z.string().max(100)).max(50).nullish(),
  certifications: z.array(z.string().max(200)).max(20).nullish(),
  awards: z.array(z.string().max(200)).max(20).nullish(),
  githubUsername: z.string().max(100).nullish(),
  twitterHandle: z.string().max(100).nullish(),
  linkedInProfile: z.string().url().max(500).nullish().or(z.literal('')),
  portfolioUrl: z.string().url().max(500).nullish().or(z.literal('')),
  resumeUrl: z.string().url().max(500).nullish().or(z.literal('')),
  isPublic: z.boolean().nullish(),
  requireAuth: z.boolean().nullish(),
  trackViews: z.boolean().nullish(),
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
      // Filter out null/undefined values for update
      const updateData: Record<string, unknown> = {};
      if (validatedData.firstName != null) updateData.firstName = validatedData.firstName;
      if (validatedData.lastName != null) updateData.lastName = validatedData.lastName;
      if (validatedData.bio != null) updateData.bio = validatedData.bio;
      if (validatedData.gender != null) updateData.gender = validatedData.gender;
      if (validatedData.dateOfBirth != null)
        updateData.dateOfBirth = validatedData.dateOfBirth
          ? new Date(validatedData.dateOfBirth)
          : null;
      if (validatedData.phoneNumber != null) updateData.phoneNumber = validatedData.phoneNumber;
      if (validatedData.location != null) updateData.location = validatedData.location;
      if (validatedData.jobTitle != null) updateData.jobTitle = validatedData.jobTitle;
      if (validatedData.company != null) updateData.company = validatedData.company;
      if (validatedData.yearsOfExperience != null)
        updateData.yearsOfExperience = validatedData.yearsOfExperience;
      if (validatedData.experiences != null) updateData.experiences = validatedData.experiences;
      if (validatedData.education != null) updateData.education = validatedData.education;
      if (validatedData.skills != null) updateData.skills = validatedData.skills;
      if (validatedData.languages != null) updateData.languages = validatedData.languages;
      if (validatedData.interests != null) updateData.interests = validatedData.interests;
      if (validatedData.certifications != null)
        updateData.certifications = validatedData.certifications;
      if (validatedData.awards != null) updateData.awards = validatedData.awards;
      if (validatedData.githubUsername != null)
        updateData.githubUsername = validatedData.githubUsername;
      if (validatedData.twitterHandle != null)
        updateData.twitterHandle = validatedData.twitterHandle;
      if (validatedData.linkedInProfile != null)
        updateData.linkedInProfile = validatedData.linkedInProfile;
      if (validatedData.resumeUrl != null) updateData.resumeUrl = validatedData.resumeUrl;
      if (validatedData.portfolioUrl != null) updateData.portfolioUrl = validatedData.portfolioUrl;
      if (validatedData.isPublic != null) updateData.isPublic = validatedData.isPublic;
      if (validatedData.requireAuth != null) updateData.requireAuth = validatedData.requireAuth;
      if (validatedData.trackViews != null) updateData.trackViews = validatedData.trackViews;

      // Filter out null/undefined values for create
      const createData = {
        bio: validatedData.bio ?? '', // bio is required
        firstName: validatedData.firstName ?? null,
        lastName: validatedData.lastName ?? null,
        gender: validatedData.gender ?? null,
        dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
        phoneNumber: validatedData.phoneNumber ?? null,
        location: validatedData.location ?? null,
        jobTitle: validatedData.jobTitle ?? null,
        company: validatedData.company ?? null,
        yearsOfExperience: validatedData.yearsOfExperience ?? null,
        experiences: validatedData.experiences ?? [],
        education: validatedData.education ?? [],
        skills: validatedData.skills ?? [],
        languages: validatedData.languages ?? [],
        interests: validatedData.interests ?? [],
        certifications: validatedData.certifications ?? [],
        awards: validatedData.awards ?? [],
        githubUsername: validatedData.githubUsername ?? null,
        twitterHandle: validatedData.twitterHandle ?? null,
        linkedInProfile: validatedData.linkedInProfile ?? null,
        resumeUrl: validatedData.resumeUrl ?? null,
        portfolioUrl: validatedData.portfolioUrl ?? null,
        isPublic: validatedData.isPublic ?? false,
        requireAuth: validatedData.requireAuth ?? false,
        trackViews: validatedData.trackViews ?? false,
        user: {
          connect: { userId },
        },
      };

      return await prisma.profile.upsert({
        where: { userId },
        update: updateData,
        create: createData,
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
