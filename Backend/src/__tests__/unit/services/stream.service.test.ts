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

import { describe, expect, it, vi } from 'vitest';
import { publishToStream, subscribeToStream } from '../../../services/stream.service.js';

describe('Stream Service', () => {
  it('correctly subscribes and publishes to a stream', async () => {
    const sessionId = 'test-session';
    const payload = { type: 'TEST_EVENT', data: { foo: 'bar' } };
    const callback = vi.fn();

    const unsubscribe = subscribeToStream(sessionId, callback);

    await publishToStream(sessionId, payload);

    expect(callback).toHaveBeenCalledWith(payload);

    unsubscribe();

    await publishToStream(sessionId, payload);
    // Should not have been called a second time
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles multiple subscribers to the same stream', async () => {
    const sessionId = 'multi-session';
    const payload = { type: 'MULTI', data: {} };
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    subscribeToStream(sessionId, cb1);
    subscribeToStream(sessionId, cb2);

    await publishToStream(sessionId, payload);

    expect(cb1).toHaveBeenCalledWith(payload);
    expect(cb2).toHaveBeenCalledWith(payload);
  });
});
