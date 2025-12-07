import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5, // Max 5 verification attempts
  WINDOW_MINUTES: 30, // Within 30 minutes
  LOCKOUT_MINUTES: 30, // Lockout for 30 minutes after exceeding
  MAX_SEND_ATTEMPTS: 5,
  SEND_WINDOW_MINUTES: 30,
  SEND_LOCKOUT_MINUTES: 30,
  PLATFORM_INVITE_MAX_ATTEMPTS: 3,
  PLATFORM_INVITE_WINDOW_MINUTES: 60,
  PLATFORM_INVITE_LOCKOUT_MINUTES: 30,
} as const;

// Redis key prefixes
export const REDIS_KEYS = {
  OTP_ATTEMPTS: 'otp:attempts:',
  OTP_LOCKOUT: 'otp:lockout:',
  OTP_SEND_ATTEMPTS: 'otp:send:attempts:',
  OTP_SEND_LOCKOUT: 'otp:send:lockout:',
  PROFILE_CACHE: 'profile:cache:',
  PROFILE_STAR: 'profile:star:',
  PLATFORM_INVITE_ATTEMPTS: 'platform:invite:attempts:',
  PLATFORM_INVITE_LOCKOUT: 'platform:invite:lockout:',
  OTP_STORE: 'otp:store:',
  STAR_RATE_LIMIT: 'star:ratelimit:',
  STAR_COUNT_CACHE: 'star:count:',
  DATA_EXPORT: 'data:export:',
  SETTINGS_CACHE: 'settings:cache:',
  FEEDBACK_RATE_LIMIT: 'feedback:ratelimit:',
  USER_REPORTS_CACHE: 'user:reports:',
  USER_SUPPORT_CACHE: 'user:support:',
  USER_LOGS_CACHE: 'user:logs:',
  USER_CREDITS_CACHE: 'user:credits:',
  USER_CREDIT_HISTORY_CACHE: 'user:credit:history:',
  RATE_LIMIT: 'ratelimit:',
  ANALYTICS: 'analytics:',
} as const;
