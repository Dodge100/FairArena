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
 * requestValidation.middleware.test.ts
 *
 * Unit tests for:
 *   - validateRequestSize  (414 on long URLs)
 *   - validateContentType  (415 on disallowed Content-Types, bypasses safe methods)
 *   - sanitizeRequest      (strips XSS from body/query/params)
 */
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

vi.mock('../../../config/security.config.js', () => ({
  REQUEST_VALIDATION_CONFIG: {
    maxUrlLength: 2048,
    allowedContentTypes: [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded',
    ],
  },
}));

// sanitizeObject → strip <script> tags
vi.mock('../../../utils/sanitization.utils.js', () => ({
  sanitizeObject: vi.fn((obj: Record<string, any>) => {
    // Minimal implementation for test verification
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      sanitized[k] = typeof v === 'string' ? v.replace(/<script[^>]*>.*?<\/script>/gi, '') : v;
    }
    return sanitized;
  }),
}));

import {
  sanitizeRequest,
  validateContentType,
  validateRequestSize,
} from '../../../middleware/requestValidation.middleware.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeReq(
  overrides: Partial<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
    query: any;
    params: any;
  }> = {},
): Request {
  return {
    url: '/api/test',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    path: '/api/test',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const r = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return r as unknown as Response;
}

const makeNext = (): NextFunction => vi.fn() as unknown as NextFunction;

// ════════════════════════════════════════════════════════════════════════════
// validateRequestSize
// ════════════════════════════════════════════════════════════════════════════
describe('validateRequestSize', () => {
  it('calls next() when URL is within limit', () => {
    const req = makeReq({ url: '/short' });
    const next = makeNext();
    validateRequestSize(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(/* no error */);
  });

  it('returns 414 when URL exceeds 2048 characters', () => {
    const req = makeReq({ url: '/' + 'a'.repeat(2050) });
    const res = makeRes();
    const next = makeNext();

    validateRequestSize(req, res, next);

    expect(res.status).toHaveBeenCalledWith(414);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'URL too long' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a URL of exactly 2048 characters', () => {
    const req = makeReq({ url: '/' + 'a'.repeat(2047) }); // total = 2048
    const next = makeNext();
    validateRequestSize(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// validateContentType
// ════════════════════════════════════════════════════════════════════════════
describe('validateContentType', () => {
  it('allows application/json', () => {
    const req = makeReq({ headers: { 'content-type': 'application/json' } });
    const next = makeNext();
    validateContentType(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows multipart/form-data', () => {
    const req = makeReq({
      headers: { 'content-type': 'multipart/form-data; boundary=---xyz' },
    });
    const next = makeNext();
    validateContentType(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 415 for text/plain on mutating methods', () => {
    const req = makeReq({ method: 'POST', headers: { 'content-type': 'text/plain' } });
    const res = makeRes();
    const next = makeNext();

    validateContentType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unsupported Media Type' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('skips Content-Type check for safe method %s', (method) => {
    const req = makeReq({ method, headers: { 'content-type': 'text/html' } });
    const next = makeNext();
    validateContentType(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows when no Content-Type and no body are present', () => {
    const req = makeReq({ headers: {}, body: undefined });
    const next = makeNext();
    validateContentType(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// sanitizeRequest
// ════════════════════════════════════════════════════════════════════════════
describe('sanitizeRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sanitizes req.body and calls next()', () => {
    const req = makeReq({
      body: { comment: '<script>alert(1)</script>Hello' },
    });
    const next = makeNext();

    sanitizeRequest(req, makeRes(), next);

    expect(req.body.comment).not.toContain('<script>');
    expect(req.body.comment).toContain('Hello');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sanitizes req.query properties', () => {
    const req = makeReq({
      query: { q: '<script>xss</script>safe' },
    });
    const next = makeNext();

    sanitizeRequest(req, makeRes(), next);

    expect((req.query as any).q).not.toContain('<script>');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sanitizes req.params', () => {
    const req = makeReq({
      params: { id: '<script>evil</script>123' },
    });
    const next = makeNext();

    sanitizeRequest(req, makeRes(), next);

    expect(req.params.id).not.toContain('<script>');
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not modify Buffer body', () => {
    const buf = Buffer.from('binary');
    const req = makeReq({ body: buf });
    const next = makeNext();

    sanitizeRequest(req, makeRes(), next);

    expect(req.body).toBe(buf); // same reference, untouched
    expect(next).toHaveBeenCalledOnce();
  });

  it('handles null body gracefully', () => {
    const req = makeReq({ body: null });
    const next = makeNext();
    sanitizeRequest(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
