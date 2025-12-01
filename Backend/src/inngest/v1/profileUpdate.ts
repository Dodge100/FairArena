import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

// Validation schema (same as in profileController.ts)
const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).nullish(),
  bio: z.string().trim().max(500).nullish(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullish(),
  dateOfBirth: z.string().nullish(),
  phoneNumber: z.string().trim().max(20).nullish(),
  location: z.string().trim().max(200).nullish(),
  jobTitle: z.string().trim().max(200).nullish(),
  company: z.string().trim().max(200).nullish(),
  yearsOfExperience: z.number().int().min(0).max(100).nullish(),
  experiences: z.array(z.string().max(500)).max(20).nullish(),
  education: z.array(z.string().max(500)).max(20).nullish(),
  skills: z.array(z.string().max(100)).max(100).nullish(),
  languages: z.array(z.string().max(50)).max(50).nullish(),
  interests: z.array(z.string().max(100)).max(50).nullish(),
  certifications: z.array(z.string().max(200)).max(20).nullish(),
  awards: z.array(z.string().max(200)).max(20).nullish(),
  githubUsername: z.string().trim().max(100).nullish(),
  twitterHandle: z.string().trim().max(100).nullish(),
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
      // Include fields that were provided in the update (including null for clearing)
      const updateData: Record<string, unknown> = {};
      if ('firstName' in validatedData) updateData.firstName = validatedData.firstName;
      if ('lastName' in validatedData) updateData.lastName = validatedData.lastName;
      if ('bio' in validatedData) updateData.bio = validatedData.bio;
      if ('gender' in validatedData) updateData.gender = validatedData.gender;
      if ('dateOfBirth' in validatedData)
        updateData.dateOfBirth = validatedData.dateOfBirth
          ? new Date(validatedData.dateOfBirth)
          : null;
      if ('phoneNumber' in validatedData) updateData.phoneNumber = validatedData.phoneNumber;
      if ('location' in validatedData) updateData.location = validatedData.location;
      if ('jobTitle' in validatedData) updateData.jobTitle = validatedData.jobTitle;
      if ('company' in validatedData) updateData.company = validatedData.company;
      if ('yearsOfExperience' in validatedData)
        updateData.yearsOfExperience = validatedData.yearsOfExperience;
      if ('experiences' in validatedData) updateData.experiences = validatedData.experiences;
      if ('education' in validatedData) updateData.education = validatedData.education;
      if ('skills' in validatedData) updateData.skills = validatedData.skills;
      if ('languages' in validatedData) updateData.languages = validatedData.languages;
      if ('interests' in validatedData) updateData.interests = validatedData.interests;
      if ('certifications' in validatedData)
        updateData.certifications = validatedData.certifications;
      if ('awards' in validatedData) updateData.awards = validatedData.awards;
      if ('githubUsername' in validatedData)
        updateData.githubUsername = validatedData.githubUsername;
      if ('twitterHandle' in validatedData) updateData.twitterHandle = validatedData.twitterHandle;
      if ('linkedInProfile' in validatedData)
        updateData.linkedInProfile = validatedData.linkedInProfile;
      if ('resumeUrl' in validatedData) updateData.resumeUrl = validatedData.resumeUrl;
      if ('portfolioUrl' in validatedData) updateData.portfolioUrl = validatedData.portfolioUrl;
      if ('isPublic' in validatedData) updateData.isPublic = validatedData.isPublic;
      if ('requireAuth' in validatedData) {
        updateData.requireAuth = validatedData.requireAuth;
        // If requireAuth is being set to false, also set trackViews to false
        if (!validatedData.requireAuth) {
          updateData.trackViews = false;
        }
      }
      if ('trackViews' in validatedData && validatedData.requireAuth !== false) {
        updateData.trackViews = validatedData.trackViews;
      }

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
