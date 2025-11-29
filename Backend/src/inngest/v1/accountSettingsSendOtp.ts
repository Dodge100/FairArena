import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getReadOnlyPrisma } from '../../config/read-only.database.js';
import { redis, REDIS_KEYS } from '../../config/redis.js';
import { sendOtpEmail } from '../../email/v1/send-mail.js';
import logger from '../../utils/logger.js';
import { inngest } from './client.js';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_SECONDS = 600; // 10 minutes

function generateOtp(): string {
  const length = crypto.randomInt(6, 13); // 6-12 characters
  const digits = '0123456789';
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  let otp = '';
  for (let i = 0; i < length; i++) {
    // 70% digits, 30% letters for better readability
    if (crypto.randomInt(0, 10) < 7) {
      otp += digits.charAt(crypto.randomInt(0, digits.length));
    } else {
      otp += alpha.charAt(crypto.randomInt(0, alpha.length));
    }
  }
  return otp;
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
      const otpKey = `${REDIS_KEYS.OTP_STORE}${userId}:account-settings`;

      // Generate OTP
      const plainOtp = generateOtp();

      // Hash the OTP
      let otpHash;
      try {
        otpHash = await bcrypt.hash(plainOtp.toUpperCase(), SALT_ROUNDS);
      } catch (hashError) {
        logger.error('Failed to hash OTP', {
          userId,
          error: hashError instanceof Error ? hashError.message : String(hashError),
        });
        throw new Error('Failed to generate OTP');
      }

      // Store OTP data in Redis with TTL
      const otpData = {
        userId,
        email: user.email,
        otpHash,
        sentFor: 'account-settings',
        createdAt: Date.now(),
        attempts: 0,
      };

      try {
        await redis.setex(otpKey, OTP_EXPIRY_SECONDS, JSON.stringify(otpData));
      } catch (redisError) {
        logger.error('Failed to store OTP in Redis', {
          userId,
          email: user.email,
          error: redisError instanceof Error ? redisError.message : String(redisError),
        });
        throw new Error('Failed to store OTP');
      }

      logger.info('OTP generated and stored in Redis', {
        userId,
        email: user.email,
        expiresIn: OTP_EXPIRY_SECONDS,
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
