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
export const formRateLimiter = arcjet({
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
