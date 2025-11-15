import arcjet, { detectBot, shield, tokenBucket } from '@arcjet/node';
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
      allow: [],
    }),

    tokenBucket({
      mode: 'LIVE',
      refillRate: 10,
      interval: 10,
      capacity: 15,
    }),
  ],
});
