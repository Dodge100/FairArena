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

/**
 * rateLimitService.test.ts
 *
 * Unit tests for the notification rate-limiting service:
 *   - checkNotificationRateLimit  (per-user, per-device, global tiers)
 *   - checkHourlyRateLimit
 *   - checkDailyRateLimit
 *   - getUserRateLimitStatus
 *   - resetUserRateLimits
 *   - checkTokenBucket
 *
 * All Redis operations are mocked via vi.hoisted() so the tests run in ms.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted Redis mock ───────────────────────────────────────────────────────
const { redisMock, REDIS_KEYS_MOCK } = vi.hoisted(() => ({
  redisMock: {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
  REDIS_KEYS_MOCK: {
    RATE_LIMIT: 'ratelimit:',
  },
}));

vi.mock('../../../config/redis.js', () => ({
  redis: redisMock,
  REDIS_KEYS: REDIS_KEYS_MOCK,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

import {
  checkDailyRateLimit,
  checkHourlyRateLimit,
  checkNotificationRateLimit,
  checkTokenBucket,
  getUserRateLimitStatus,
  resetUserRateLimits,
} from '../../../services/v1/rateLimitService.js';

// ════════════════════════════════════════════════════════════════════════════
// checkNotificationRateLimit
// ════════════════════════════════════════════════════════════════════════════
describe('checkNotificationRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.expire.mockResolvedValue(1);
    redisMock.ttl.mockResolvedValue(30);
  });

  it('allows when user count is within per-minute limit', async () => {
    redisMock.incr
      .mockResolvedValueOnce(3) // user/minute
      .mockResolvedValueOnce(1); // global/second
    redisMock.ttl.mockResolvedValue(55);

    const result = await checkNotificationRateLimit('user_1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7); // 10 - 3
  });

  it('blocks when user per-minute limit is exceeded', async () => {
    redisMock.incr.mockResolvedValueOnce(11); // > 10 (per-minute limit)
    redisMock.ttl.mockResolvedValue(45);

    const result = await checkNotificationRateLimit('user_1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('blocks when device per-minute limit is exceeded', async () => {
    redisMock.incr
      .mockResolvedValueOnce(5) // user/minute — within limit
      .mockResolvedValueOnce(6); // device/minute — exceeds 5
    redisMock.ttl.mockResolvedValue(30);

    const result = await checkNotificationRateLimit('user_1', 'device_1');

    expect(result.allowed).toBe(false);
  });

  it('blocks when global per-second limit is exceeded', async () => {
    redisMock.incr
      .mockResolvedValueOnce(1) // user/minute
      .mockResolvedValueOnce(1001); // global/second > 1000
    redisMock.ttl.mockResolvedValue(1);

    const result = await checkNotificationRateLimit('user_1');

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(1);
  });

  it('fails open (allows) when Redis throws', async () => {
    redisMock.incr.mockRejectedValue(new Error('Redis offline'));

    const result = await checkNotificationRateLimit('user_fail');

    expect(result.allowed).toBe(true);
  });

  it('does not set expire for first-time device counter', async () => {
    redisMock.incr
      .mockResolvedValueOnce(1) // user/minute — first time
      .mockResolvedValueOnce(1) // device/minute — first time
      .mockResolvedValueOnce(1); // global/second — first time
    redisMock.ttl.mockResolvedValue(60);

    await checkNotificationRateLimit('user_1', 'device_A');

    // expire should be called for user, device, and global keys
    expect(redisMock.expire).toHaveBeenCalledTimes(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// checkHourlyRateLimit
// ════════════════════════════════════════════════════════════════════════════
describe('checkHourlyRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.expire.mockResolvedValue(1);
  });

  it('returns true when count is within the hourly limit', async () => {
    redisMock.incr.mockResolvedValue(50); // ≤ 100
    expect(await checkHourlyRateLimit('user_1')).toBe(true);
  });

  it('returns false when count exceeds the hourly limit', async () => {
    redisMock.incr.mockResolvedValue(101); // > 100
    expect(await checkHourlyRateLimit('user_1')).toBe(false);
  });

  it('sets 3600s expiry on first increment', async () => {
    redisMock.incr.mockResolvedValue(1); // first call
    await checkHourlyRateLimit('user_first');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.stringContaining('user_first'), 3600);
  });

  it('fails open when Redis throws', async () => {
    redisMock.incr.mockRejectedValue(new Error('timeout'));
    expect(await checkHourlyRateLimit('user_err')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// checkDailyRateLimit
// ════════════════════════════════════════════════════════════════════════════
describe('checkDailyRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.expire.mockResolvedValue(1);
  });

  it('returns true when count is within the daily limit', async () => {
    redisMock.incr.mockResolvedValue(200); // ≤ 500
    expect(await checkDailyRateLimit('user_1')).toBe(true);
  });

  it('returns false when count exceeds the daily limit', async () => {
    redisMock.incr.mockResolvedValue(501); // > 500
    expect(await checkDailyRateLimit('user_1')).toBe(false);
  });

  it('sets 86400s expiry on first increment', async () => {
    redisMock.incr.mockResolvedValue(1);
    await checkDailyRateLimit('user_first');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.stringContaining('user_first'), 86400);
  });

  it('fails open when Redis throws', async () => {
    redisMock.incr.mockRejectedValue(new Error('timeout'));
    expect(await checkDailyRateLimit('user_err')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getUserRateLimitStatus
// ════════════════════════════════════════════════════════════════════════════
describe('getUserRateLimitStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct counts and remaining values', async () => {
    redisMock.get
      .mockResolvedValueOnce('3') // minute
      .mockResolvedValueOnce('40') // hour
      .mockResolvedValueOnce('100'); // day

    const status = await getUserRateLimitStatus('user_1');

    expect(status.minuteCount).toBe(3);
    expect(status.minuteRemaining).toBe(7); // 10 - 3
    expect(status.hourCount).toBe(40);
    expect(status.hourRemaining).toBe(60); // 100 - 40
    expect(status.dayCount).toBe(100);
    expect(status.dayRemaining).toBe(400); // 500 - 100
  });

  it('treats null Redis values as 0', async () => {
    redisMock.get.mockResolvedValue(null);

    const status = await getUserRateLimitStatus('user_new');

    expect(status.minuteCount).toBe(0);
    expect(status.minuteRemaining).toBe(10);
  });

  it('returns full limits and 0 counts on Redis error', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));

    const status = await getUserRateLimitStatus('user_err');

    expect(status.minuteCount).toBe(0);
    expect(status.minuteRemaining).toBe(10);
    expect(status.hourRemaining).toBe(100);
    expect(status.dayRemaining).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// resetUserRateLimits
// ════════════════════════════════════════════════════════════════════════════
describe('resetUserRateLimits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes all three rate-limit keys for the user', async () => {
    redisMock.del.mockResolvedValue(1);

    await resetUserRateLimits('user_1');

    expect(redisMock.del).toHaveBeenCalledTimes(3);
    expect(redisMock.del).toHaveBeenCalledWith(expect.stringContaining('user_1:minute'));
    expect(redisMock.del).toHaveBeenCalledWith(expect.stringContaining('user_1:hour'));
    expect(redisMock.del).toHaveBeenCalledWith(expect.stringContaining('user_1:day'));
  });

  it('does not throw on Redis error', async () => {
    redisMock.del.mockRejectedValue(new Error('Redis down'));
    await expect(resetUserRateLimits('user_err')).resolves.toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// checkTokenBucket
// ════════════════════════════════════════════════════════════════════════════
describe('checkTokenBucket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.setex.mockResolvedValue('OK');
  });

  it('allows and decrements when bucket has tokens', async () => {
    // Simulates a bucket with 5 tokens remaining
    redisMock.get.mockResolvedValue(JSON.stringify({ tokens: 5, lastRefill: Date.now() }));

    const allowed = await checkTokenBucket('mykey', 10, 1, 1000);

    expect(allowed).toBe(true);
    // setex called to persist updated token count (4)
    expect(redisMock.setex).toHaveBeenCalledWith(
      expect.stringContaining('mykey'),
      expect.any(Number),
      expect.stringContaining('"tokens":4'),
    );
  });

  it('grants max tokens to a brand-new (null) bucket and consumes one', async () => {
    redisMock.get.mockResolvedValue(null);

    const allowed = await checkTokenBucket('newkey', 10, 1, 1000);

    expect(allowed).toBe(true);
    expect(redisMock.setex).toHaveBeenCalledWith(
      expect.stringContaining('newkey'),
      expect.any(Number),
      expect.stringContaining('"tokens":9'),
    );
  });

  it('rejects when bucket is empty', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ tokens: 0, lastRefill: Date.now() }));

    const allowed = await checkTokenBucket('exhausted', 10, 1, 1000);

    expect(allowed).toBe(false);
  });

  it('refills tokens based on elapsed time', async () => {
    // 5 seconds ago, had 0 tokens; 5 intervals of 1 token each → 5 new tokens
    const old = Date.now() - 5000;
    redisMock.get.mockResolvedValue(JSON.stringify({ tokens: 0, lastRefill: old }));

    const allowed = await checkTokenBucket('refill', 10, 1, 1000);

    expect(allowed).toBe(true); // 5 refilled, consumed 1 → 4 left
  });

  it('fails open (allows) when Redis throws', async () => {
    redisMock.get.mockRejectedValue(new Error('Redis down'));

    const allowed = await checkTokenBucket('errkey', 10, 1, 1000);

    expect(allowed).toBe(true);
  });
});
