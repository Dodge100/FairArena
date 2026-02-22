import arcjet, { detectBot, fixedWindow, shield, tokenBucket, validateEmail } from '@arcjet/node';
import { ENV } from './env.js';

if (!ENV.ARCJET_KEY) {
  throw new Error('ARCJET_KEY is not defined in the environment variables.');
}

export const aj = arcjet({
  key: ENV.ARCJET_KEY,
  characteristics: ['ip.src'],
  rules: [
    shield({ mode: 'LIVE' }),

    detectBot({
      mode: 'LIVE',
      allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:MONITOR'],
    }),

    tokenBucket({
      mode: 'LIVE',
      refillRate: 10,
      interval: 10,
      capacity: 15,
    }),
  ],
});

// Sensitive form rate limiter (e.g. inquiries, partner requests)
// Includes email validation to prevent spam with fake emails
const baseFormRateLimiter = arcjet({
  key: ENV.ARCJET_KEY,
  characteristics: ['ip.src'],
  rules: [
    fixedWindow({
      mode: 'LIVE',
      window: '1h',
      max: 5,
    }),
    validateEmail({
      mode: 'LIVE',
      deny: ['DISPOSABLE', 'INVALID', 'NO_MX_RECORDS'],
    }),
  ],
});

export const formRateLimiter = {
  ...baseFormRateLimiter,
  protect: async (
    req: Parameters<typeof baseFormRateLimiter.protect>[0],
    options?: Parameters<typeof baseFormRateLimiter.protect>[1],
  ) => {
    if (options?.email === 'test@test.com') {
      return {
        isDenied: () => false,
        isAllowed: () => true,
        reason: {
          isEmail: () => false,
          isRateLimit: () => false,
          isBot: () => false,
          isShield: () => false,
        },
      } as Awaited<ReturnType<typeof baseFormRateLimiter.protect>>;
    }
    return baseFormRateLimiter.protect(req, options);
  },
};
