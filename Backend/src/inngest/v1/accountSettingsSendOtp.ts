import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { sendOtpEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const sendOtpForAccountSettings = inngest.createFunction(
  {
    id: 'send-otp-account-settings',
    retries: 3,
  },
  { event: 'account-settings/send-otp' },
  async ({ event, step }) => {
    const { userId } = event.data;

    if (!userId) {
      logger.error('Missing userId in send-otp event');
      throw new Error('userId is required');
    }

    logger.info('Starting OTP generation for account settings', { userId });

    const user = await step.run('fetch-user', async () => {
      const foundUser = await getReadOnlyPrisma().user.findUnique({
        where: { userId },
        select: { email: true, userId: true },
      });

      if (!foundUser) {
        logger.error('User not found', { userId });
        throw new Error('User not found');
      }

      return foundUser;
    });

    const otp = await step.run('generate-and-store-otp', async () => {
      const plainOtp = generateOtp();
      const otpHash = await bcrypt.hash(plainOtp, SALT_ROUNDS);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // Delete any existing OTPs for this user and purpose
      await prisma.otp.deleteMany({
        where: {
          userId,
          sentFor: 'account-settings',
          verified: false,
        },
      });

      // Store the hashed OTP
      await prisma.otp.create({
        data: {
          userId,
          email: user.email,
          otpHash,
          sentFor: 'account-settings',
          expiresAt,
        },
      });

      logger.info('OTP generated and stored', {
        userId,
        email: user.email,
        expiresAt,
      });

      return plainOtp;
    });

    await step.run('send-otp-email', async () => {
      try {
        await sendOtpEmail(user.email, otp);
        logger.info('OTP email sent successfully', { email: user.email });
      } catch (error) {
        logger.error('Failed to send OTP email', {
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    return { success: true, email: user.email };
  },
);
