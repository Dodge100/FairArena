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
 * auth.service.test.ts
 *
 * Production-grade test suite for the core authentication service layer.
 * Tests password hashing, JWT lifecycle, session management (CRUD + rotation),
 * refresh-token validation, ban enforcement, and edge-case resilience.
 *
 * Approach: every external I/O (Redis, Prisma, logger, ENV) is mocked via the
 * global setup so tests are deterministic and fast (no network / DB required).
 */
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { redisMock } from '../../setup';

// ─── System Under Test ───────────────────────────────────────────────────────
// We import after mocks are in place (setup.ts runs first via setupFiles).
import {
  createSession,
  destroyAllUserSessions,
  destroySession,
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  getSession,
  getUserSessions,
  hashPassword,
  hashToken,
  rotateRefreshToken,
  storeSessionBinding,
  updateSessionActivity,
  updateUserBanStatus,
  validatePasswordStrength,
  validateRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifySessionBinding,
} from '../../../services/auth.service.js';

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────
const makeUserId = () => `user_${Math.random().toString(36).slice(2)}`;

// ════════════════════════════════════════════════════════════════════════════
// 1. PASSWORD HASHING
// ════════════════════════════════════════════════════════════════════════════
describe('hashPassword / verifyPassword', () => {
  it('produces a bcrypt hash that verifies correctly', async () => {
    const password = 'SecurePass1!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorse1');
    await expect(verifyPassword('WrongHorse1', hash)).resolves.toBe(false);
  });

  it('generates unique hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('SamePass1');
    const hash2 = await hashPassword('SamePass1');
    expect(hash1).not.toBe(hash2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PASSWORD STRENGTH VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('validatePasswordStrength', () => {
  const cases: Array<[string, boolean, string[]]> = [
    ['ValidPass1', true, []],
    ['short1A', false, ['Password must be at least 8 characters long']],
    ['nouppercase1', false, ['Password must contain at least one uppercase letter']],
    ['NOLOWERCASE1', false, ['Password must contain at least one lowercase letter']],
    ['NoNumbers!', false, ['Password must contain at least one number']],
    [
      'ab',
      false,
      [
        'Password must be at least 8 characters long',
        'Password must contain at least one uppercase letter',
        'Password must contain at least one number',
      ],
    ],
  ];

  it.each(cases)('"%s" → valid=%s', (pw, expectedValid, expectedErrors) => {
    const result = validatePasswordStrength(pw);
    expect(result.valid).toBe(expectedValid);
    for (const err of expectedErrors) {
      expect(result.errors).toContain(err);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. SECURE TOKEN / HASH UTILITIES
// ════════════════════════════════════════════════════════════════════════════
describe('generateSecureToken / hashToken', () => {
  it('generates a hex string of the requested length', () => {
    const token = generateSecureToken(32);
    expect(token).toHaveLength(64); // 32 bytes → 64 hex chars
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique tokens on each call', () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    expect(t1).not.toBe(t2);
  });

  it('hashToken produces a consistent SHA-256 hex digest', () => {
    const token = 'my-test-token';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('different inputs produce different hashes', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. JWT GENERATION & VERIFICATION
// ════════════════════════════════════════════════════════════════════════════
describe('generateAccessToken / verifyAccessToken', () => {
  const userId = 'user_abc123';
  const sessionId = 'sess_xyz789';

  it('generates and successfully verifies a token', () => {
    const token = generateAccessToken(userId, sessionId);
    expect(token).toBeTruthy();
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe(userId);
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.type).toBe('access');
  });

  it('throws "Invalid token" for a tampered token', () => {
    const token = generateAccessToken(userId, sessionId);
    const [h, p, s] = token.split('.');
    const tampered = `${h}.${p}.${s}tampered`;
    expect(() => verifyAccessToken(tampered)).toThrow('Invalid token');
  });

  it('throws "Invalid token" for a completely wrong string', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow('Invalid token');
  });

  it('throws "Token expired" for a token with past expiry', async () => {
    // Create a token with -1s expiry (already expired)
    const secret = 'test-jwt-secret-that-is-long-enough-32ch';
    const expiredToken = jwt.sign({ userId, sessionId, type: 'access' }, secret, {
      expiresIn: -1,
      issuer: 'fairarena',
      audience: 'fairarena-api',
    });
    expect(() => verifyAccessToken(expiredToken)).toThrow('Token expired');
  });

  it('throws "Invalid token type" when type is not access', () => {
    const secret = 'test-jwt-secret-that-is-long-enough-32ch';
    const badTypeToken = jwt.sign({ userId, sessionId, type: 'refresh' }, secret, {
      issuer: 'fairarena',
      audience: 'fairarena-api',
    });
    expect(() => verifyAccessToken(badTypeToken)).toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SESSION LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════
describe('createSession / getSession / destroySession', () => {
  let userId: string;
  let refreshToken: string;

  beforeEach(() => {
    userId = makeUserId();
    refreshToken = generateRefreshToken();
  });

  it('creates a session and retrieves it', async () => {
    const sessionId = await createSession(userId, refreshToken, {
      deviceName: 'Chrome on Windows',
      deviceType: 'browser',
      ipAddress: '127.0.0.1',
    });

    expect(sessionId).toBeTruthy();

    const session = await getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(userId);
    expect(session!.isBanned).toBe(false);
  });

  it('stores the hash—not the raw refresh token', async () => {
    const sessionId = await createSession(userId, refreshToken);
    const session = await getSession(sessionId);
    expect(session!.refreshTokenHash).not.toBe(refreshToken);
    expect(session!.refreshTokenHash).toBe(hashToken(refreshToken));
  });

  it('adds sessionId to the user session set', async () => {
    const sessionId = await createSession(userId, refreshToken);
    const members = await redisMock.smembers(`user_sessions:${userId}`);
    expect(members).toContain(sessionId);
  });

  it('returns null for a non-existent session', async () => {
    await expect(getSession('nonexistent_session')).resolves.toBeNull();
  });

  it('destroySession removes the session and its set entry', async () => {
    const sessionId = await createSession(userId, refreshToken);
    await destroySession(sessionId);
    await expect(getSession(sessionId)).resolves.toBeNull();
    const members = await redisMock.smembers(`user_sessions:${userId}`);
    expect(members).not.toContain(sessionId);
  });

  it('creates session with ban status propagated', async () => {
    const sessionId = await createSession(
      userId,
      refreshToken,
      {},
      {
        isBanned: true,
        banReason: 'Spam',
      },
    );
    const session = await getSession(sessionId);
    expect(session!.isBanned).toBe(true);
    expect(session!.banReason).toBe('Spam');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. SESSION BINDING (CSRF-like cookie binding)
// ════════════════════════════════════════════════════════════════════════════
describe('storeSessionBinding / verifySessionBinding', () => {
  it('stores and verifies a valid binding token', async () => {
    const sessionId = 'test-session-binding';
    const bindingToken = generateSecureToken(16);
    const bindingHash = hashToken(bindingToken);
    await storeSessionBinding(sessionId, bindingHash);
    await expect(verifySessionBinding(sessionId, bindingToken)).resolves.toBe(true);
  });

  it('rejects an incorrect binding token', async () => {
    const sessionId = 'test-session-binding-2';
    const bindingToken = generateSecureToken(16);
    await storeSessionBinding(sessionId, hashToken(bindingToken));
    await expect(verifySessionBinding(sessionId, 'wrong-token')).resolves.toBe(false);
  });

  it('returns false when no binding exists', async () => {
    await expect(verifySessionBinding('ghost-session', 'any-token')).resolves.toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. REFRESH TOKEN VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('validateRefreshToken', () => {
  let userId: string;
  let sessionId: string;
  let refreshToken: string;

  beforeEach(async () => {
    userId = makeUserId();
    refreshToken = generateRefreshToken();
    sessionId = await createSession(userId, refreshToken);
  });

  it('validates the correct refresh token', async () => {
    const session = await validateRefreshToken(sessionId, refreshToken);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(userId);
  });

  it('returns null for an incorrect refresh token', async () => {
    const session = await validateRefreshToken(sessionId, 'wrong-token');
    expect(session).toBeNull();
  });

  it('returns null for a non-existent session', async () => {
    const session = await validateRefreshToken('ghost-session', refreshToken);
    expect(session).toBeNull();
  });

  it('returns the session (with isBanned=true) without destroying it for banned users', async () => {
    // Manually patch the session to be banned
    const session = await getSession(sessionId);
    session!.isBanned = true;
    await redisMock.setex(`session:${sessionId}`, 86400, JSON.stringify(session));

    const result = await validateRefreshToken(sessionId, refreshToken);
    // Should return session so caller can handle the ban response
    expect(result).not.toBeNull();
    expect(result!.isBanned).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. TOKEN ROTATION
// ════════════════════════════════════════════════════════════════════════════
describe('rotateRefreshToken', () => {
  let userId: string;
  let sessionId: string;
  let refreshToken: string;

  beforeEach(async () => {
    userId = makeUserId();
    refreshToken = generateRefreshToken();
    sessionId = await createSession(userId, refreshToken);
    // Set a positive TTL so rotate succeeds
    redisMock.ttl.mockResolvedValue(86400);
  });

  it('returns new tokens when existing refresh token is valid', async () => {
    const result = await rotateRefreshToken(sessionId, refreshToken);
    expect(result).not.toBeNull();
    expect(result!.newRefreshToken).toBeTruthy();
    expect(result!.accessToken).toBeTruthy();
    expect(result!.newRefreshToken).not.toBe(refreshToken);
  });

  it('returns null for an invalid refresh token', async () => {
    const result = await rotateRefreshToken(sessionId, 'bad-token');
    expect(result).toBeNull();
  });

  it('returns null for a non-existent session', async () => {
    const result = await rotateRefreshToken('no-session', refreshToken);
    expect(result).toBeNull();
  });

  it('returns null for a banned user', async () => {
    const session = await getSession(sessionId);
    session!.isBanned = true;
    await redisMock.setex(`session:${sessionId}`, 86400, JSON.stringify(session));
    const result = await rotateRefreshToken(sessionId, refreshToken);
    expect(result).toBeNull();
  });

  it('updates the refresh token hash in Redis', async () => {
    const result = await rotateRefreshToken(sessionId, refreshToken);
    const updatedSession = await getSession(sessionId);
    expect(updatedSession!.refreshTokenHash).toBe(hashToken(result!.newRefreshToken));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. SESSION ACTIVITY UPDATE
// ════════════════════════════════════════════════════════════════════════════
describe('updateSessionActivity', () => {
  it('updates lastActiveAt timestamp', async () => {
    const userId = makeUserId();
    const refreshToken = generateRefreshToken();
    const sessionId = await createSession(userId, refreshToken);
    redisMock.ttl.mockResolvedValue(86400);

    const before = await getSession(sessionId);
    await new Promise((r) => setTimeout(r, 10)); // tiny delay
    await updateSessionActivity(sessionId);
    const after = await getSession(sessionId);

    expect(new Date(after!.lastActiveAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.lastActiveAt).getTime(),
    );
  });

  it('does nothing for a non-existent session (no error)', async () => {
    await expect(updateSessionActivity('ghost')).resolves.toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. GET ALL USER SESSIONS
// ════════════════════════════════════════════════════════════════════════════
describe('getUserSessions', () => {
  it('returns all active sessions for a user', async () => {
    const userId = makeUserId();
    const rt1 = generateRefreshToken();
    const rt2 = generateRefreshToken();
    const s1 = await createSession(userId, rt1);
    const s2 = await createSession(userId, rt2);

    const sessions = await getUserSessions(userId);
    const ids = sessions.map((s) => s.sessionId);
    expect(ids).toContain(s1);
    expect(ids).toContain(s2);
  });

  it('returns empty array for user with no sessions', async () => {
    const sessions = await getUserSessions('no-sessions-user');
    expect(sessions).toEqual([]);
  });

  it('auto-cleans stale session IDs from the set', async () => {
    const userId = makeUserId();
    // Add a phantom sessionId that has no backing data
    await redisMock.sadd(`user_sessions:${userId}`, 'stale-session-123');
    const sessions = await getUserSessions(userId);
    expect(sessions.find((s) => s.sessionId === 'stale-session-123')).toBeUndefined();
    // Confirm stale entry was removed
    const members = await redisMock.smembers(`user_sessions:${userId}`);
    expect(members).not.toContain('stale-session-123');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. DESTROY ALL USER SESSIONS
// ════════════════════════════════════════════════════════════════════════════
describe('destroyAllUserSessions', () => {
  it('destroys all sessions and returns the count', async () => {
    const userId = makeUserId();
    const rt1 = generateRefreshToken();
    const rt2 = generateRefreshToken();
    const rt3 = generateRefreshToken();
    await createSession(userId, rt1);
    await createSession(userId, rt2);
    await createSession(userId, rt3);

    const count = await destroyAllUserSessions(userId);
    expect(count).toBe(3);

    const sessions = await getUserSessions(userId);
    expect(sessions).toHaveLength(0);
  });

  it('returns 0 when user has no sessions', async () => {
    const count = await destroyAllUserSessions('new-user-no-sessions');
    expect(count).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 12. BAN STATUS PROPAGATION
// ════════════════════════════════════════════════════════════════════════════
describe('updateUserBanStatus', () => {
  it('sets isBanned=true on all active sessions', async () => {
    const userId = makeUserId();
    const s1 = await createSession(userId, generateRefreshToken());
    const s2 = await createSession(userId, generateRefreshToken());
    redisMock.ttl.mockResolvedValue(86400);

    await updateUserBanStatus(userId, true, 'Terms violation');

    const [session1, session2] = await Promise.all([getSession(s1), getSession(s2)]);
    expect(session1!.isBanned).toBe(true);
    expect(session1!.banReason).toBe('Terms violation');
    expect(session2!.isBanned).toBe(true);
  });

  it('lifts a ban by setting isBanned=false', async () => {
    const userId = makeUserId();
    const sessionId = await createSession(
      userId,
      generateRefreshToken(),
      {},
      {
        isBanned: true,
        banReason: 'Reason',
      },
    );
    redisMock.ttl.mockResolvedValue(86400);

    await updateUserBanStatus(userId, false);
    const session = await getSession(sessionId);
    expect(session!.isBanned).toBe(false);
  });

  it('gracefully handles WRONGTYPE redis error on ban update', async () => {
    const userId = makeUserId();
    redisMock.smembers.mockRejectedValueOnce(
      Object.assign(new Error('WRONGTYPE'), { message: 'WRONGTYPE error' }),
    );
    // Should not throw
    await expect(updateUserBanStatus(userId, true)).resolves.toBeUndefined();
    expect(redisMock.del).toHaveBeenCalled();
  });
});
