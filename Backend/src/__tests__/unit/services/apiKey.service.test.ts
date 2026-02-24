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
 * apiKey.service.test.ts
 *
 * Tests for API key generation, validation, caching strategy, expiry/revocation,
 * throttled last-used updates, and listing utilities.
 */
import { describe, expect, it } from 'vitest';
import { prismaMock, redisMock } from '../../setup.js';

import {
  createApiKey,
  extractKeyPrefix,
  generateApiKey,
  hashApiKey,
  invalidateApiKeyCache,
  listUserApiKeys,
  revokeApiKey,
  updateApiKeyLastUsed,
  updateApiKeyName,
  validateApiKey,
} from '../../../services/apiKey.service.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const LIVE_KEY = generateApiKey('live');
const TEST_KEY = generateApiKey('test');
const USER_ID = 'user_test_123';

const makePrismaApiKey = (overrides: Record<string, unknown> = {}) => ({
  id: 'apikey_abc',
  userId: USER_ID,
  name: 'My Key',
  keyPrefix: extractKeyPrefix(LIVE_KEY),
  keyHash: hashApiKey(LIVE_KEY),
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  createdAt: new Date('2024-01-01'),
  user: { isBanned: false },
  ...overrides,
});

// ════════════════════════════════════════════════════════════════════════════
// 1. KEY GENERATION
// ════════════════════════════════════════════════════════════════════════════
describe('generateApiKey', () => {
  it('starts with "fa_live_" for live environment', () => {
    expect(LIVE_KEY).toMatch(/^fa_live_/);
  });

  it('starts with "fa_test_" for test environment', () => {
    expect(TEST_KEY).toMatch(/^fa_test_/);
  });

  it('generates unique keys on every call', () => {
    const k1 = generateApiKey('live');
    const k2 = generateApiKey('live');
    expect(k1).not.toBe(k2);
  });

  it('defaults to live environment', () => {
    expect(generateApiKey()).toMatch(/^fa_live_/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PREFIX EXTRACTION
// ════════════════════════════════════════════════════════════════════════════
describe('extractKeyPrefix', () => {
  it('extracts the correct prefix from a live key', () => {
    const prefix = extractKeyPrefix(LIVE_KEY);
    expect(prefix).toMatch(/^fa_live_/);
    // Should be short (env + 4 random chars)
    expect(prefix.length).toBeLessThan(20);
  });

  it('falls back to first 12 chars for malformed keys', () => {
    const prefix = extractKeyPrefix('badkey');
    expect(prefix).toBe('badkey');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. HASHING
// ════════════════════════════════════════════════════════════════════════════
describe('hashApiKey', () => {
  it('produces a SHA-256 hex string (64 chars)', () => {
    const hash = hashApiKey(LIVE_KEY);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(hashApiKey(LIVE_KEY)).toBe(hashApiKey(LIVE_KEY));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. CREATE API KEY
// ════════════════════════════════════════════════════════════════════════════
describe('createApiKey', () => {
  it('creates an API key and returns the full key only once', async () => {
    const fakeRecord = makePrismaApiKey();
    prismaMock.apiKey.create.mockResolvedValue(fakeRecord);

    const result = await createApiKey(USER_ID, 'CI Key');
    expect(result.fullKey).toMatch(/^fa_live_/);
    expect(result.id).toBe(fakeRecord.id);
    expect(result.name).toBe(fakeRecord.name);
    expect(prismaMock.apiKey.create).toHaveBeenCalledOnce();
  });

  it('sets expiry when expiresIn is provided', async () => {
    const fakeRecord = makePrismaApiKey({ expiresAt: new Date(Date.now() + 86400000) });
    prismaMock.apiKey.create.mockResolvedValue(fakeRecord);

    const result = await createApiKey(USER_ID, 'Temp Key', { expiresIn: 1 });
    expect(result.expiresAt).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. VALIDATE API KEY
// ════════════════════════════════════════════════════════════════════════════
describe('validateApiKey', () => {
  it('rejects keys that do not start with "fa_"', async () => {
    const result = await validateApiKey('invalid-key');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/format/i);
  });

  it('validates a key via database on cache miss', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(makePrismaApiKey());

    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(true);
    expect(result.apiKey?.userId).toBe(USER_ID);
    expect(prismaMock.apiKey.findUnique).toHaveBeenCalledOnce();
  });

  it('uses Redis cache on second call (no DB hit)', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(makePrismaApiKey());

    // First call — populates cache
    await validateApiKey(LIVE_KEY);
    // Second call — should use cache
    prismaMock.apiKey.findUnique.mockClear();
    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(true);
    expect(prismaMock.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a key not found in DB', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(null);
    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('rejects an expired key', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(
      makePrismaApiKey({ expiresAt: new Date('2000-01-01') }),
    );
    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('rejects a revoked key', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(
      makePrismaApiKey({ revokedAt: new Date('2024-01-15') }),
    );
    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/revoked/i);
  });

  it('rejects a key for a banned user', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValue(makePrismaApiKey({ user: { isBanned: true } }));
    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/suspended/i);
  });

  it('uses cached invalid result without hitting DB', async () => {
    // Pre-seed the cache with an invalid marker
    const keyHash = hashApiKey(LIVE_KEY);
    await redisMock.setex(`apikey:${keyHash}`, 60, JSON.stringify({ invalid: true }));

    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(prismaMock.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('detects expiry from cached data without hitting DB', async () => {
    const keyHash = hashApiKey(LIVE_KEY);
    await redisMock.setex(
      `apikey:${keyHash}`,
      300,
      JSON.stringify({
        id: 'k1',
        userId: USER_ID,
        name: 'Test',
        keyPrefix: 'fa_live_xx',
        expiresAt: new Date('2000-01-01').toISOString(),
      }),
    );

    const result = await validateApiKey(LIVE_KEY);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. REVOKE API KEY
// ════════════════════════════════════════════════════════════════════════════
describe('revokeApiKey', () => {
  it('revokes an existing key and returns true', async () => {
    prismaMock.apiKey.findFirst.mockResolvedValue(makePrismaApiKey());
    prismaMock.apiKey.update.mockResolvedValue(makePrismaApiKey({ revokedAt: new Date() }));

    const result = await revokeApiKey(USER_ID, 'apikey_abc');
    expect(result).toBe(true);
    expect(prismaMock.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'apikey_abc' } }),
    );
  });

  it('returns false when key not found or already revoked', async () => {
    prismaMock.apiKey.findFirst.mockResolvedValue(null);
    const result = await revokeApiKey(USER_ID, 'not-found');
    expect(result).toBe(false);
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
  });

  it('invalidates the Redis cache on revocation', async () => {
    const fakeKey = makePrismaApiKey();
    prismaMock.apiKey.findFirst.mockResolvedValue(fakeKey);
    prismaMock.apiKey.update.mockResolvedValue(fakeKey);

    await revokeApiKey(USER_ID, fakeKey.id);
    expect(redisMock.del).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. UPDATE LAST USED (THROTTLED)
// ════════════════════════════════════════════════════════════════════════════
describe('updateApiKeyLastUsed', () => {
  it('updates the DB and sets a throttle key on first use', async () => {
    prismaMock.apiKey.update.mockResolvedValue({});

    await updateApiKeyLastUsed('apikey_abc', '1.2.3.4');
    expect(prismaMock.apiKey.update).toHaveBeenCalledOnce();
    expect(redisMock.setex).toHaveBeenCalledWith('apikey_lastused:apikey_abc', 300, '1');
  });

  it('does NOT update the DB if throttle key is present', async () => {
    // Pre-seed throttle flag
    await redisMock.setex('apikey_lastused:apikey_abc', 300, '1');

    await updateApiKeyLastUsed('apikey_abc', '1.2.3.4');
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
  });

  it('silently ignores DB errors', async () => {
    prismaMock.apiKey.update.mockRejectedValue(new Error('DB down'));
    await expect(updateApiKeyLastUsed('apikey_abc', '1.2.3.4')).resolves.toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. LIST USER API KEYS
// ════════════════════════════════════════════════════════════════════════════
describe('listUserApiKeys', () => {
  it('returns all active keys for a user', async () => {
    const keys = [makePrismaApiKey(), makePrismaApiKey({ id: 'apikey_def' })];
    prismaMock.apiKey.findMany.mockResolvedValue(keys);

    const result = await listUserApiKeys(USER_ID);
    expect(result).toHaveLength(2);
    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, revokedAt: null } }),
    );
  });

  it('returns an empty array when user has no keys', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([]);
    const result = await listUserApiKeys(USER_ID);
    expect(result).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. UPDATE KEY NAME
// ════════════════════════════════════════════════════════════════════════════
describe('updateApiKeyName', () => {
  it('returns true when key is found and updated', async () => {
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 });
    const result = await updateApiKeyName(USER_ID, 'apikey_abc', 'New Name');
    expect(result).toBe(true);
  });

  it('returns false when no rows were updated', async () => {
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 0 });
    const result = await updateApiKeyName(USER_ID, 'apikey_xyz', 'New Name');
    expect(result).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. INVALIDATE CACHE
// ════════════════════════════════════════════════════════════════════════════
describe('invalidateApiKeyCache', () => {
  it('deletes the cache entry for the given hash', async () => {
    const keyHash = hashApiKey(LIVE_KEY);
    await redisMock.setex(`apikey:${keyHash}`, 300, '{}');
    await invalidateApiKeyCache(keyHash);
    const cached = await redisMock.get(`apikey:${keyHash}`);
    expect(cached).toBeNull();
  });
});
