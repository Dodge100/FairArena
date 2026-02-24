/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Inngest } from 'inngest';
import { ENV } from '../../config/env.js';

export const inngest = new Inngest({
  id: 'fairarena-backend',
  signingKey: ENV.INNGEST_SIGNING_KEY,
  eventKey: ENV.INNGEST_EVENT_KEY,
  baseUrl: ENV.INNGEST_BASE_URL,
  // Production optimizations
  env: ENV.NODE_ENV,
  concurrency: ENV.NODE_ENV === 'production' ? 100 : 10,
  logger: ENV.NODE_ENV === 'development' ? console : undefined,
});
