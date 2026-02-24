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
 * errorHandler.middleware.test.ts
 *
 * Tests matching the ACTUAL errorHandler implementation exactly.
 */
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted() ensures ENV_MOCK is available inside the vi.mock() factory (which is hoisted)
const ENV_MOCK = vi.hoisted(() => ({ NODE_ENV: 'test' as string }));
vi.mock('../../../config/env.js', () => ({ ENV: ENV_MOCK }));

import {
  asyncHandler,
  errorHandler,
  notFoundHandler,
} from '../../../middleware/errorHandler.middleware.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeRes = () => {
  const res: Partial<Response> = {};
  res.setHeader = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const makeReq = (path = '/api/v1/test'): Request =>
  ({ path, method: 'POST', ip: '127.0.0.1', user: undefined }) as unknown as Request;

const makeNext = () => vi.fn() as unknown as NextFunction;

// Error factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkErr = (overrides: Record<string, any> = {}) =>
  Object.assign(new Error('Test error'), overrides);

beforeEach(() => {
  ENV_MOCK.NODE_ENV = 'test';
});

// ════════════════════════════════════════════════════════════════════════════
// 1. STATUS CODES & ERROR TYPES
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – status codes and error types', () => {
  it.each([
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [409, 'Conflict'],
    [413, 'Payload Too Large'],
    [415, 'Unsupported Media Type'],
    [422, 'Unprocessable Entity'],
    [429, 'Too Many Requests'],
    [500, 'Internal Server Error'],
    [503, 'Service Unavailable'],
  ])('status %i → error type "%s"', (status, expectedType) => {
    const res = makeRes();
    errorHandler(mkErr({ statusCode: status }), makeReq(), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expectedType }));
  });

  it('defaults to 500 when no statusCode on error', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), makeReq(), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('uses err.status as fallback when err.statusCode is absent', () => {
    const res = makeRes();
    errorHandler(mkErr({ status: 404 }), makeReq(), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. PRODUCTION MESSAGE SANITIZATION  (5xx in production)
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – production sanitization', () => {
  it('hides internal details for 5xx in production', () => {
    ENV_MOCK.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(
      mkErr({ statusCode: 500, message: 'DB at /etc/secrets/.env failed' }),
      makeReq(),
      res,
      makeNext(),
    );
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message).toBe('An internal server error occurred. Please try again later.');
  });

  it('exposes message for 4xx even in production', () => {
    ENV_MOCK.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(mkErr({ statusCode: 400, message: 'Bad input' }), makeReq(), res, makeNext());
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message).toContain('Bad input');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. MESSAGE SANITIZATION (file paths, SQL keywords, length)
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – message sanitization', () => {
  it('replaces file paths with [path]', () => {
    const res = makeRes();
    errorHandler(
      mkErr({ statusCode: 400, message: 'File not found: /home/user/secret.env' }),
      makeReq(),
      res,
      makeNext(),
    );
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message).not.toContain('/home/user/secret.env');
    expect(payload.message).toContain('[path]');
  });

  it('replaces SQL keywords with [query]', () => {
    const res = makeRes();
    errorHandler(
      mkErr({ statusCode: 400, message: 'SELECT * FROM users failed' }),
      makeReq(),
      res,
      makeNext(),
    );
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message).not.toContain('SELECT');
    expect(payload.message).toContain('[query]');
  });

  it('truncates messages longer than 200 chars', () => {
    const res = makeRes();
    errorHandler(mkErr({ statusCode: 400, message: 'A'.repeat(500) }), makeReq(), res, makeNext());
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(payload.message).toContain('...');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. DEVELOPMENT EXTRAS
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – development mode', () => {
  it('includes stack trace in development', () => {
    ENV_MOCK.NODE_ENV = 'development';
    const error = mkErr({ statusCode: 500 });
    const res = makeRes();
    errorHandler(error, makeReq(), res, makeNext());
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.stack).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CUSTOM CODE & VALIDATION ERRORS
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – custom fields', () => {
  it('passes through err.code', () => {
    const res = makeRes();
    errorHandler(mkErr({ statusCode: 403, code: 'USER_BANNED' }), makeReq(), res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_BANNED' }));
  });

  it('passes through err.errors array', () => {
    const errors = [{ field: 'email', message: 'Invalid' }];
    const res = makeRes();
    errorHandler(mkErr({ statusCode: 422, errors }), makeReq(), res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors }));
  });

  it('always sets success: false', () => {
    const res = makeRes();
    errorHandler(new Error('any'), makeReq(), res, makeNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. SECURITY HEADERS
// ════════════════════════════════════════════════════════════════════════════
describe('errorHandler – security headers', () => {
  it('sets X-Content-Type-Options and X-Frame-Options', () => {
    const res = makeRes();
    errorHandler(new Error('test'), makeReq(), res, makeNext());
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. NOT FOUND HANDLER
// ════════════════════════════════════════════════════════════════════════════
describe('notFoundHandler', () => {
  it('returns 404 with RESOURCE_NOT_FOUND code', () => {
    const res = makeRes();
    notFoundHandler(makeReq('/api/unknown'), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Not Found',
        code: 'RESOURCE_NOT_FOUND',
      }),
    );
  });

  it('returns a user-friendly message', () => {
    const res = makeRes();
    notFoundHandler(makeReq(), res);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.message).toMatch(/not found/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. ASYNC HANDLER
// ════════════════════════════════════════════════════════════════════════════
describe('asyncHandler', () => {
  it('calls next(error) when async handler rejects', async () => {
    const error = new Error('async failure');
    const handler = asyncHandler(async () => {
      throw error;
    });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('does NOT call next when async handler resolves normally', async () => {
    const handler = asyncHandler(async (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('passes req, res, next to the wrapped function', async () => {
    const inner = vi.fn(async () => {});
    const handler = asyncHandler(inner);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await handler(req, res, next);
    expect(inner).toHaveBeenCalledWith(req, res, next);
  });
});
