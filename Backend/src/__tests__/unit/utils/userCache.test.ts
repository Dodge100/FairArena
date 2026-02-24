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
 * userCache.test.ts
 *
 * Unit tests for getCachedUserInfo, getUserDisplayName, and invalidateUserCache.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared with vi.hoisted() so they are available inside vi.mock() factories ─
// We use vi.hoisted because vi.mock() calls are moved to the top of the file during execution.
const { redisMock, prismaMock, REDIS_KEYS } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
  },
  REDIS_KEYS: { PROFILE_CACHE: 'profile:' },
}));

vi.mock('../../../config/redis.js', () => ({
  redis: redisMock,
  REDIS_KEYS: REDIS_KEYS,
}));

vi.mock('../../../config/database.js', () => ({
  prisma: prismaMock,
}));

import {
  getCachedUserInfo,
  getUserDisplayName,
  invalidateUserCache,
  type CachedUserInfo,
} from '../../../utils/userCache.js';

const USER: CachedUserInfo = {
  id: 'user_1',
  firstName: 'Alice',
  lastName: 'Smith',
  profileImageUrl: 'https://example.com/avatar.png',
  email: 'alice@example.com',
};

// ════════════════════════════════════════════════════════════════════════════
// getCachedUserInfo
// ════════════════════════════════════════════════════════════════════════════
describe('getCachedUserInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON when cache hits with a string', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify(USER));
    const result = await getCachedUserInfo('user_1');
    expect(result).toEqual(USER);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns the object directly when Upstash returns pre-parsed object', async () => {
    redisMock.get.mockResolvedValue(USER); // Upstash-style auto-parsed
    const result = await getCachedUserInfo('user_1');
    expect(result).toEqual(USER);
  });

  it('deletes [object Object] corrupted cache and returns null', async () => {
    redisMock.get.mockResolvedValue('[object Object]');
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await getCachedUserInfo('user_1');
    expect(redisMock.del).toHaveBeenCalledWith('profile:user_1');
    expect(result).toBeNull();
  });

  it('fetches from DB and caches when cache is empty', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(USER);
    redisMock.set.mockResolvedValue('OK');

    const result = await getCachedUserInfo('user_1');

    expect(result).toEqual(USER);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      select: expect.any(Object),
    });
    expect(redisMock.set).toHaveBeenCalledWith('profile:user_1', JSON.stringify(USER), { ex: 300 });
  });

  it('returns null when user is not in DB and cache is empty', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await getCachedUserInfo('user_1');
    expect(result).toBeNull();
  });

  it('falls back to DB when cache.get throws', async () => {
    redisMock.get.mockRejectedValue(new Error('Redis offline'));
    prismaMock.user.findUnique.mockResolvedValue(USER);
    const result = await getCachedUserInfo('user_1');
    expect(result).toEqual(USER);
  });

  it('returns null when both cache and DB throw', async () => {
    redisMock.get.mockRejectedValue(new Error('Redis offline'));
    prismaMock.user.findUnique.mockRejectedValue(new Error('DB offline'));
    const result = await getCachedUserInfo('user_1');
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getUserDisplayName
// ════════════════════════════════════════════════════════════════════════════
describe('getUserDisplayName', () => {
  it('returns "First Last" when both names are set', () => {
    expect(getUserDisplayName(USER)).toBe('Alice Smith');
  });

  it('returns first name only when last name is null', () => {
    expect(getUserDisplayName({ ...USER, lastName: null } as any)).toBe('Alice');
  });

  it('returns email when first name is null', () => {
    expect(getUserDisplayName({ ...USER, firstName: null, lastName: null } as any)).toBe(
      'alice@example.com',
    );
  });

  it("returns 'A user' when first name and email are both absent", () => {
    expect(getUserDisplayName({ ...USER, firstName: null, lastName: null, email: '' } as any)).toBe(
      'A user',
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// invalidateUserCache
// ════════════════════════════════════════════════════════════════════════════
describe('invalidateUserCache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls redis.del with the correct cache key', async () => {
    redisMock.del.mockResolvedValue(1);
    await invalidateUserCache('user_99');
    expect(redisMock.del).toHaveBeenCalledWith('profile:user_99');
  });

  it('does not throw when redis.del fails', async () => {
    redisMock.del.mockRejectedValueOnce(new Error('Redis error'));
    await expect(invalidateUserCache('user_99')).resolves.not.toThrow();
  });
});
