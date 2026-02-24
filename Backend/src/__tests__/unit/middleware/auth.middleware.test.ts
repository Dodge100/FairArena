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
 * auth.middleware.test.ts
 *
 * Tests for protectRoute, optionalAuth, and protectStreamRoute.
 * All service calls are mocked so no Redis/DB is needed.
 */
import { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

// ─── Service mocks ───────────────────────────────────────────────────────────
vi.mock('../../../services/auth.service.js', () => ({
  verifyAccessToken: vi.fn(),
  getSession: vi.fn(),
  verifySessionBinding: vi.fn(),
  extractBearerToken: vi.fn(),
  updateSessionActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/apiKey.service.js', () => ({
  validateApiKey: vi.fn(),
  updateApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
}));

// Import mocks AFTER vi.mock hoisting
import {
  optionalAuth,
  protectRoute,
  protectStreamRoute,
} from '../../../middleware/auth.middleware.js';
import * as apiKeySvc from '../../../services/apiKey.service.js';
import * as authSvc from '../../../services/auth.service.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────
const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const mockReq = (
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
  ip = '127.0.0.1',
): Request =>
  ({
    headers,
    cookies,
    ip,
    path: '/api/test',
    method: 'GET',
  }) as unknown as Request;

const mockNext = () => vi.fn() as unknown as NextFunction;

const VALID_SESSION = {
  userId: 'user_123',
  refreshTokenHash: 'hash',
  isBanned: false,
  banReason: undefined,
  deviceType: 'browser',
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

const VALID_API_KEY = {
  id: 'apikey_abc',
  userId: 'user_123',
  name: 'Test Key',
  keyPrefix: 'fa_live_abcd',
  expiresAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
};

// Shortcuts
const verifyToken = () => authSvc.verifyAccessToken as ReturnType<typeof vi.fn>;
const getSession = () => authSvc.getSession as ReturnType<typeof vi.fn>;
const verifyBinding = () => authSvc.verifySessionBinding as ReturnType<typeof vi.fn>;
const extractToken = () => authSvc.extractBearerToken as ReturnType<typeof vi.fn>;
const validateKey = () => apiKeySvc.validateApiKey as ReturnType<typeof vi.fn>;

// ════════════════════════════════════════════════════════════════════════════
// protectRoute
// ════════════════════════════════════════════════════════════════════════════
describe('protectRoute', () => {
  describe('API Key authentication', () => {
    it('authenticates with Bearer fa_... key', async () => {
      validateKey().mockResolvedValue({ valid: true, apiKey: VALID_API_KEY });
      const req = mockReq({ authorization: 'Bearer fa_live_abc123' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.userId).toBe('user_123');
      expect(req.apiKeyAuth).toBe(true);
    });

    it('authenticates with X-API-Key header', async () => {
      validateKey().mockResolvedValue({ valid: true, apiKey: VALID_API_KEY });
      const req = mockReq({ 'x-api-key': 'fa_live_somekey' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.apiKeyAuth).toBe(true);
    });

    it('returns 401 for invalid API key', async () => {
      validateKey().mockResolvedValue({ valid: false, error: 'Key revoked' });
      const req = mockReq({ authorization: 'Bearer fa_live_badkey' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('JWT authentication', () => {
    it('authenticates with a valid JWT', async () => {
      extractToken().mockReturnValue('valid.jwt.token');
      verifyToken().mockReturnValue({ userId: 'user_123', sessionId: 'sess_abc' });
      getSession().mockResolvedValue(VALID_SESSION);
      const req = mockReq({ authorization: 'Bearer valid.jwt.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toEqual({ userId: 'user_123', sessionId: 'sess_abc' });
    });

    it('returns 401 with TOKEN_EXPIRED when token is expired', async () => {
      extractToken().mockReturnValue('expired.jwt.token');
      verifyToken().mockImplementation(() => {
        throw new Error('Token expired');
      });
      const req = mockReq({ authorization: 'Bearer expired.jwt.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
    });

    it('returns 401 for invalid token', async () => {
      extractToken().mockReturnValue('bad.token');
      verifyToken().mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const req = mockReq({ authorization: 'Bearer bad.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 with SESSION_INVALID when session not found in Redis', async () => {
      extractToken().mockReturnValue('valid.jwt.token');
      verifyToken().mockReturnValue({ userId: 'user_123', sessionId: 'sess_abc' });
      getSession().mockResolvedValue(null);
      const req = mockReq({ authorization: 'Bearer valid.jwt.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_INVALID' }));
    });

    it('returns 401 when JWT userId does not match session userId', async () => {
      extractToken().mockReturnValue('valid.jwt.token');
      verifyToken().mockReturnValue({ userId: 'evil_user', sessionId: 'sess_abc' });
      getSession().mockResolvedValue({ ...VALID_SESSION, userId: 'user_123' });
      const req = mockReq({ authorization: 'Bearer valid.jwt.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 403 USER_BANNED for banned user', async () => {
      extractToken().mockReturnValue('valid.jwt.token');
      verifyToken().mockReturnValue({ userId: 'user_123', sessionId: 'sess_abc' });
      getSession().mockResolvedValue({ ...VALID_SESSION, isBanned: true, banReason: 'Spam' });
      const req = mockReq({ authorization: 'Bearer valid.jwt.token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_BANNED' }));
    });
  });

  describe('Cookie authentication', () => {
    it('returns 401 when no token, key, or session cookie', async () => {
      // No API key prefix in header, extractBearerToken returns null
      extractToken().mockReturnValue(null);
      const req = mockReq({}, {});
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('authenticates via session cookie with valid binding', async () => {
      extractToken().mockReturnValue(null);
      verifyBinding().mockResolvedValue(true);
      getSession().mockResolvedValue(VALID_SESSION);
      const req = mockReq({}, { active_session: 'sess_abc', session_sess_abc: 'binding-token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.userId).toBe('user_123');
    });

    it('returns 401 when session binding is invalid', async () => {
      extractToken().mockReturnValue(null);
      verifyBinding().mockResolvedValue(false);
      const req = mockReq({}, { active_session: 'sess_abc', session_sess_abc: 'wrong-token' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when binding cookie is missing', async () => {
      extractToken().mockReturnValue(null);
      // has active_session but no binding cookie
      const req = mockReq({}, { active_session: 'sess_abc' });
      const res = mockRes();
      const next = mockNext();

      await protectRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  it('returns 401 when an unexpected error is thrown', async () => {
    extractToken().mockImplementation(() => {
      throw new Error('Boom');
    });
    const req = mockReq({ authorization: 'Bearer x' });
    const res = mockRes();
    const next = mockNext();

    await protectRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// optionalAuth
// ════════════════════════════════════════════════════════════════════════════
describe('optionalAuth', () => {
  it('calls next without user when no token', async () => {
    extractToken().mockReturnValue(null);
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('attaches user when token and session are valid', async () => {
    extractToken().mockReturnValue('valid.token');
    verifyToken().mockReturnValue({ userId: 'u1', sessionId: 's1' });
    getSession().mockResolvedValue({ ...VALID_SESSION, userId: 'u1' });
    const req = mockReq({ authorization: 'Bearer valid.token' });
    const res = mockRes();
    const next = mockNext();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.userId).toBe('u1');
  });

  it('calls next without error when token is invalid (graceful degradation)', async () => {
    extractToken().mockReturnValue('bad.token');
    verifyToken().mockImplementation(() => {
      throw new Error('Invalid token');
    });
    const req = mockReq({ authorization: 'Bearer bad.token' });
    const res = mockRes();
    const next = mockNext();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// protectStreamRoute
// ════════════════════════════════════════════════════════════════════════════
describe('protectStreamRoute', () => {
  it('falls through to protectRoute when Authorization header is present (JWT path)', async () => {
    // protectStreamRoute delegates to protectRoute when a token is present.
    // protectRoute internally re-calls extractBearerToken + verifyToken + getSession.
    // userId in JWT payload MUST match session.userId to pass the cross-check.
    extractToken().mockReturnValue('valid.jwt');
    verifyToken().mockReturnValue({ userId: 'user_123', sessionId: 'sess_abc' });
    getSession().mockResolvedValue({ ...VALID_SESSION, userId: 'user_123' });
    const req = mockReq({ authorization: 'Bearer valid.jwt' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when no cookie present and no token', async () => {
    extractToken().mockReturnValue(null);
    const req = mockReq({}, {}); // no cookies
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when session cookie exists but binding token is missing', async () => {
    extractToken().mockReturnValue(null);
    const req = mockReq({}, { active_session: 'sess_stream' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when binding verification fails', async () => {
    extractToken().mockReturnValue(null);
    verifyBinding().mockResolvedValue(false);
    const req = mockReq({}, { active_session: 'sess_stream', session_sess_stream: 'bad' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('authenticates via cookie binding when valid', async () => {
    extractToken().mockReturnValue(null);
    verifyBinding().mockResolvedValue(true);
    getSession().mockResolvedValue(VALID_SESSION);
    const req = mockReq({}, { active_session: 'sess_stream', session_sess_stream: 'valid-token' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.userId).toBe('user_123');
  });

  it('returns 403 for banned stream user', async () => {
    extractToken().mockReturnValue(null);
    verifyBinding().mockResolvedValue(true);
    getSession().mockResolvedValue({ ...VALID_SESSION, isBanned: true });
    const req = mockReq({}, { active_session: 'sess_stream', session_sess_stream: 'valid-token' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when session not found', async () => {
    extractToken().mockReturnValue(null);
    verifyBinding().mockResolvedValue(true);
    getSession().mockResolvedValue(null);
    const req = mockReq({}, { active_session: 'sess_stream', session_sess_stream: 'valid-token' });
    const res = mockRes();
    const next = mockNext();

    await protectStreamRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
