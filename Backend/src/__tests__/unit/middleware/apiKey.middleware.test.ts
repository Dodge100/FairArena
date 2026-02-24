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
 * apiKey.middleware.test.ts
 *
 * Unit tests for apiKeyAuth and optionalApiKeyAuth middleware.
 * Covers all three extraction paths (Bearer, X-API-Key, query param),
 * validation failure paths, and the fire-and-forget last-used update.
 */
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const { validateApiKeyMock, updateApiKeyLastUsedMock } = vi.hoisted(() => ({
  validateApiKeyMock: vi.fn(),
  updateApiKeyLastUsedMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/apiKey.service.js', () => ({
  validateApiKey: validateApiKeyMock,
  updateApiKeyLastUsed: updateApiKeyLastUsedMock,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

import { apiKeyAuth, optionalApiKeyAuth } from '../../../middleware/apiKey.middleware.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VALID_KEY_DATA = {
  id: 'key_1',
  keyPrefix: 'fa_live_xxxx',
  userId: 'user_abc',
  name: 'Test Key',
};

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    ip: '127.0.0.1',
    path: '/test',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const makeNext = (): NextFunction => vi.fn() as unknown as NextFunction;

// ════════════════════════════════════════════════════════════════════════════
// apiKeyAuth
// ════════════════════════════════════════════════════════════════════════════
describe('apiKeyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Extraction paths ──────────────────────────────────────────────────────
  it('extracts API key from Authorization: Bearer fa_live_xxx', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    const req = makeReq({ headers: { authorization: 'Bearer fa_live_abc123' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(validateApiKeyMock).toHaveBeenCalledWith('fa_live_abc123');
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).userId).toBe('user_abc');
    expect((req as any).apiKeyAuth).toBe(true);
  });

  it('extracts API key from X-API-Key header', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_xyz789' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(validateApiKeyMock).toHaveBeenCalledWith('fa_live_xyz789');
    expect(next).toHaveBeenCalledOnce();
  });

  it('extracts API key from query parameter api_key', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    const req = makeReq({ query: { api_key: 'fa_live_query123' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(validateApiKeyMock).toHaveBeenCalledWith('fa_live_query123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('prefers Authorization Bearer over X-API-Key', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    const req = makeReq({
      headers: {
        authorization: 'Bearer fa_live_bearer',
        'x-api-key': 'fa_live_header',
      },
    });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(validateApiKeyMock).toHaveBeenCalledWith('fa_live_bearer');
  });

  // ── Missing key ───────────────────────────────────────────────────────────
  it('returns 401 when no API key is provided at all', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'API key required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores Bearer tokens that do not start with fa_', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer not-an-api-key' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    // Falls through to "no API key" → 401
    expect(res.status).toHaveBeenCalledWith(401);
    expect(validateApiKeyMock).not.toHaveBeenCalled();
  });

  // ── Invalid key ───────────────────────────────────────────────────────────
  it('returns 401 when validateApiKey says invalid', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: false, error: 'Key revoked' });
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_revoked' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid API key', message: 'Key revoked' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Error path ────────────────────────────────────────────────────────────
  it('returns 500 when validateApiKey throws', async () => {
    validateApiKeyMock.mockRejectedValue(new Error('Redis down'));
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_any' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication failed' }),
    );
  });

  // ── Last-used update (fire and forget) ────────────────────────────────────
  it('fires updateApiKeyLastUsed asynchronously (does not block next())', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    updateApiKeyLastUsedMock.mockResolvedValue(undefined);
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_ok' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // updateApiKeyLastUsed is called (fire-and-forget)
    expect(updateApiKeyLastUsedMock).toHaveBeenCalledWith(VALID_KEY_DATA.id, expect.any(String));
  });

  it('does not propagate updateApiKeyLastUsed errors to the caller', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    updateApiKeyLastUsedMock.mockRejectedValue(new Error('Redis error'));
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_ok' } });
    const res = makeRes();
    const next = makeNext();

    await apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// optionalApiKeyAuth
// ════════════════════════════════════════════════════════════════════════════
describe('optionalApiKeyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits when req.userId is already set (session auth)', async () => {
    const req = makeReq({ userId: 'existing-user' } as any);
    const res = makeRes();
    const next = makeNext();

    await optionalApiKeyAuth(req, res, next);

    expect(validateApiKeyMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('enriches request when API key is valid', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: true, apiKey: VALID_KEY_DATA });
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_opt123' } });
    const res = makeRes();
    const next = makeNext();

    await optionalApiKeyAuth(req, res, next);

    expect((req as any).apiKeyAuth).toBe(true);
    expect((req as any).userId).toBe('user_abc');
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() without enriching when no API key is provided', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await optionalApiKeyAuth(req, res, next);

    expect(validateApiKeyMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).apiKeyAuth).toBeUndefined();
  });

  it('calls next() without enriching when API key is invalid', async () => {
    validateApiKeyMock.mockResolvedValue({ valid: false, error: 'Bad key' });
    const req = makeReq({ headers: { 'x-api-key': 'fa_live_bad' } });
    const res = makeRes();
    const next = makeNext();

    await optionalApiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).apiKeyAuth).toBeUndefined();
  });
});
