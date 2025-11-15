import { Inngest } from 'inngest';
import { ENV } from '../../config/env.js';

export const inngest = new Inngest({
  id: 'fairarena-backend',
  signingKey: ENV.INNGEST_SIGNING_KEY,
  eventKey: ENV.INNGEST_EVENT_KEY,
  // Production optimizations
  env: ENV.NODE_ENV,
  concurrency: ENV.NODE_ENV === 'production' ? 100 : 10,
  logger: ENV.NODE_ENV === 'development' ? console : undefined,
});
