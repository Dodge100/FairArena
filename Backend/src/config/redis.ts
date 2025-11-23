import { Redis } from '@upstash/redis';
import { ENV } from './env.js';

export const redis = new Redis({
  url: ENV.UPSTASH_REDIS_REST_URL,
  token: ENV.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 15,
  LOCKOUT_MINUTES: 15,
  MAX_SEND_ATTEMPTS: 3,
  SEND_WINDOW_MINUTES: 60,
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
  PLATFORM_INVITE_ATTEMPTS: 'platform:invite:attempts:',
  PLATFORM_INVITE_LOCKOUT: 'platform:invite:lockout:',
} as const;
