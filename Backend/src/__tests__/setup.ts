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

// Global test setup - mocks all external dependencies before any test file runs
import { vi } from 'vitest';

// ─── Redis Mock ─────────────────────────────────────────────────────────────
const redisStore = new Map<string, { value: string; ttl?: number; setAt: number }>();

export const redisMock = {
  get: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return null;
    if (entry.ttl) {
      const elapsed = (Date.now() - entry.setAt) / 1000;
      if (elapsed > entry.ttl) {
        redisStore.delete(key);
        return null;
      }
    }
    return entry.value;
  }),
  set: vi.fn(async (key: string, value: string) => {
    redisStore.set(key, { value, setAt: Date.now() });
    return 'OK';
  }),
  setex: vi.fn(async (key: string, ttl: number, value: string) => {
    redisStore.set(key, { value, ttl, setAt: Date.now() });
    return 'OK';
  }),
  del: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (redisStore.delete(key)) count++;
    }
    return count;
  }),
  exists: vi.fn(async (key: string) => (redisStore.has(key) ? 1 : 0)),
  ttl: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return -2;
    if (!entry.ttl) return -1;
    const elapsed = (Date.now() - entry.setAt) / 1000;
    const remaining = entry.ttl - elapsed;
    return remaining > 0 ? Math.floor(remaining) : -2;
  }),
  expire: vi.fn(async (key: string, ttl: number) => {
    const entry = redisStore.get(key);
    if (!entry) return 0;
    redisStore.set(key, { ...entry, ttl, setAt: Date.now() });
    return 1;
  }),
  sadd: vi.fn(async (key: string, ...members: string[]) => {
    const entry = redisStore.get(key);
    let set: Set<string>;
    if (entry) {
      try {
        set = new Set(JSON.parse(entry.value));
      } catch {
        set = new Set();
      }
    } else {
      set = new Set();
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    redisStore.set(key, { value: JSON.stringify([...set]), setAt: Date.now() });
    return added;
  }),
  srem: vi.fn(async (key: string, ...members: string[]) => {
    const entry = redisStore.get(key);
    if (!entry) return 0;
    const set: Set<string> = new Set(JSON.parse(entry.value));
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    redisStore.set(key, { value: JSON.stringify([...set]), setAt: Date.now() });
    return removed;
  }),
  smembers: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return [];
    try {
      return JSON.parse(entry.value);
    } catch {
      return [];
    }
  }),
  incr: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    const val = entry ? parseInt(entry.value, 10) + 1 : 1;
    redisStore.set(key, { value: String(val), setAt: Date.now() });
    return val;
  }),
  lpush: vi.fn(async () => 1),
  lrange: vi.fn(async () => []),
  lrem: vi.fn(async () => 0),
  llen: vi.fn(async () => 0),
  keys: vi.fn(async (pattern: string) => {
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
    return [...redisStore.keys()].filter((k) => regex.test(k));
  }),
  flushall: vi.fn(async () => {
    redisStore.clear();
    return 'OK';
  }),
  pipeline: vi.fn(() => ({
    setex: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
  _store: redisStore, // expose for assertions
};

// ─── Prisma Mock ────────────────────────────────────────────────────────────
export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  apiKey: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  notification: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return Promise.all(fn as Promise<unknown>[]);
  }),
  $disconnect: vi.fn(),
};

// ─── Logger Mock ─────────────────────────────────────────────────────────────
export const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  http: vi.fn(),
};

// ─── ENV Mock ────────────────────────────────────────────────────────────────
export const envMock = {
  JWT_SECRET: 'test-jwt-secret-that-is-long-enough-32ch',
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  BCRYPT_ROUNDS: 4, // Use fast rounds for testing
  SESSION_PREFIX: 'session:',
  USER_SESSIONS_PREFIX: 'user_sessions:',
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
  BACKEND_URL: 'http://localhost:3000',
  PORT: 3000,
};

// ─── Module Mocks ─────────────────────────────────────────────────────────────
vi.mock('../config/redis.js', () => ({
  redis: redisMock,
  REDIS_KEYS: {
    FAILED_LOGINS: (email: string) => `failed_logins:${email}`,
    LOCKOUT: (email: string) => `lockout:${email}`,
    EMAIL_VERIFICATION: (token: string) => `email_verify:${token}`,
    PASSWORD_RESET: (token: string) => `pw_reset:${token}`,
    USER_SESSIONS: (userId: string) => `user_sessions:${userId}`,
  },
}));

vi.mock('../config/database.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../utils/logger.js', () => ({
  default: loggerMock,
}));

vi.mock('../config/env.js', () => ({
  ENV: envMock,
}));

// ─── Lifecycle ───────────────────────────────────────────────────────────────
beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  // Re-implement smart mocks after clear
  redisMock.get.mockImplementation(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return null;
    return entry.value;
  });
  redisMock.set.mockImplementation(async (key: string, value: string) => {
    redisStore.set(key, { value, setAt: Date.now() });
    return 'OK';
  });
  redisMock.setex.mockImplementation(async (key: string, ttl: number, value: string) => {
    redisStore.set(key, { value, ttl, setAt: Date.now() });
    return 'OK';
  });
  redisMock.del.mockImplementation(async (...keys: string[]) => {
    let cnt = 0;
    for (const k of keys) if (redisStore.delete(k)) cnt++;
    return cnt;
  });
  redisMock.ttl.mockImplementation(async (key: string) => {
    const e = redisStore.get(key);
    if (!e) return -2;
    if (!e.ttl) return -1;
    return Math.floor(e.ttl - (Date.now() - e.setAt) / 1000);
  });
  redisMock.sadd.mockImplementation(async (key: string, ...members: string[]) => {
    const e = redisStore.get(key);
    const set = e ? new Set<string>(JSON.parse(e.value)) : new Set<string>();
    let added = 0;
    for (const m of members)
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    redisStore.set(key, { value: JSON.stringify([...set]), setAt: Date.now() });
    return added;
  });
  redisMock.srem.mockImplementation(async (key: string, ...members: string[]) => {
    const e = redisStore.get(key);
    if (!e) return 0;
    const set: Set<string> = new Set(JSON.parse(e.value));
    let removed = 0;
    for (const m of members) if (set.delete(m)) removed++;
    redisStore.set(key, { value: JSON.stringify([...set]), setAt: Date.now() });
    return removed;
  });
  redisMock.smembers.mockImplementation(async (key: string) => {
    const e = redisStore.get(key);
    if (!e) return [];
    try {
      return JSON.parse(e.value);
    } catch {
      return [];
    }
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
