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
 * csrf.middleware.test.ts
 *
 * Tests for CSRF token generation, setting, validation, and rotation.
 * Covers safe-method bypass, exempt-path bypass, timing-safe comparison,
 * missing token scenarios, and token rotation on success.
 */
import { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

// ─── Mock CSRF_CONFIG ────────────────────────────────────────────────────────
vi.mock('../../../config/security.config.js', () => ({
  CSRF_CONFIG: {
    tokenLength: 32,
    cookieName: 'csrf_token',
    headerName: 'x-csrf-token',
    cookieOptions: { httpOnly: true, sameSite: 'strict', secure: true },
    exemptPaths: ['/api/v1/auth/refresh', '/api/v1/webhooks'],
    safeMethods: ['GET', 'HEAD', 'OPTIONS'],
  },
}));

import {
  csrfProtection,
  generateCsrfToken,
  setCsrfToken,
  validateCsrfToken,
} from '../../../middleware/csrf.middleware.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeMockRes = () => {
  const cookies: Record<string, unknown> = {};
  const headers: Record<string, string> = {};
  const res = {
    cookies,
    headers,
    cookie: vi.fn((name: string, value: string) => {
      cookies[name] = value;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const makeReq = (overrides: Partial<Request> = {}): Partial<Request> => ({
  ip: '127.0.0.1',
  path: '/api/v1/profile',
  method: 'POST',
  cookies: {},
  headers: {},
  ...overrides,
});

const makeNext = (): NextFunction => vi.fn() as unknown as NextFunction;

// ════════════════════════════════════════════════════════════════════════════
// 1. TOKEN GENERATION
// ════════════════════════════════════════════════════════════════════════════
describe('generateCsrfToken', () => {
  it('generates a hex string of 64 characters (32 bytes)', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique tokens on each call', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. SET CSRF TOKEN MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════
describe('setCsrfToken', () => {
  it('generates a new token when cookie is absent', () => {
    const req = makeReq({ cookies: {} });
    const res = makeMockRes();
    const next = makeNext();

    setCsrfToken(req as Request, res, next);

    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    expect(next).toHaveBeenCalledOnce();
  });

  it('reuses the existing cookie token instead of generating a new one', () => {
    const existingToken = generateCsrfToken();
    const req = makeReq({ cookies: { csrf_token: existingToken } });
    const res = makeMockRes();
    const next = makeNext();

    setCsrfToken(req as Request, res, next);

    // Should echo the existing token, not set a new cookie
    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', existingToken);
    // IMPORTANT: no NEW cookie should be set
    expect(res.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next(error) when an unhandled error occurs', () => {
    const req = makeReq();
    const res = {
      cookie: vi.fn(() => {
        throw new Error('cookie error');
      }),
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = makeNext();

    setCsrfToken(req as Request, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. VALIDATE CSRF TOKEN MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════
describe('validateCsrfToken', () => {
  // ── Safe methods bypass ───────────────────────────────────────────────────
  it.each(['GET', 'HEAD', 'OPTIONS'])('skips validation for safe method %s', (method) => {
    const req = makeReq({ method, path: '/api/v1/profile' });
    const res = makeMockRes();
    const next = makeNext();
    validateCsrfToken(req as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.json).not.toHaveBeenCalled();
  });

  // ── Exempt paths ──────────────────────────────────────────────────────────
  it.each(['/api/v1/auth/refresh', '/api/v1/webhooks/stripe'])(
    'skips validation for exempt path "%s"',
    (path) => {
      const req = makeReq({ method: 'POST', path });
      const res = makeMockRes();
      const next = makeNext();
      validateCsrfToken(req as Request, res, next);
      expect(next).toHaveBeenCalledOnce();
    },
  );

  // ── Missing tokens ────────────────────────────────────────────────────────
  it('returns 403 CSRF_TOKEN_MISSING when both cookie and header are absent', () => {
    const req = makeReq({ method: 'POST', cookies: {}, headers: {} });
    const res = makeMockRes();
    const next = makeNext();

    validateCsrfToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_TOKEN_MISSING' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 CSRF_TOKEN_MISSING when cookie is present but header is absent', () => {
    const token = generateCsrfToken();
    const req = makeReq({
      method: 'POST',
      cookies: { csrf_token: token },
      headers: {},
    });
    const res = makeMockRes();
    const next = makeNext();

    validateCsrfToken(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_TOKEN_MISSING' }));
  });

  // ── Token mismatch ────────────────────────────────────────────────────────
  it('returns 403 CSRF_TOKEN_INVALID when tokens do not match', () => {
    const token = generateCsrfToken();
    const req = makeReq({
      method: 'POST',
      cookies: { csrf_token: token },
      headers: { 'x-csrf-token': generateCsrfToken() }, // different token
    });
    const res = makeMockRes();
    const next = makeNext();

    validateCsrfToken(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_TOKEN_INVALID' }));
  });

  // ── Valid token ───────────────────────────────────────────────────────────
  it('calls next() and rotates the CSRF token when tokens match', () => {
    const token = generateCsrfToken();
    const req = makeReq({
      method: 'POST',
      cookies: { csrf_token: token },
      headers: { 'x-csrf-token': token },
    });
    const res = makeMockRes();
    const next = makeNext();

    validateCsrfToken(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    // New token should be set (rotation)
    const newCookieToken = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(newCookieToken).toBeTruthy();
    expect(newCookieToken).not.toBe(token); // rotated
  });

  // ── Buffer-length mismatch ────────────────────────────────────────────────
  it('returns 403 CSRF_TOKEN_INVALID for tokens of different lengths', () => {
    const token = generateCsrfToken();
    const req = makeReq({
      method: 'POST',
      cookies: { csrf_token: token },
      headers: { 'x-csrf-token': 'short' },
    });
    const res = makeMockRes();
    const next = makeNext();

    // timingSafeEqual will throw on mismatched lengths → caught as error → 403
    validateCsrfToken(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. COMBINED csrfProtection
// ════════════════════════════════════════════════════════════════════════════
describe('csrfProtection (combined middleware array)', () => {
  it('is an array of two middleware functions', () => {
    expect(Array.isArray(csrfProtection)).toBe(true);
    expect(csrfProtection).toHaveLength(2);
    expect(typeof csrfProtection[0]).toBe('function');
    expect(typeof csrfProtection[1]).toBe('function');
  });
});
