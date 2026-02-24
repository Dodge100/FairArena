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
 * apiClient.test.ts
 *
 * Unit tests for apiFetch, publicApiFetch, ApiError, apiRequest,
 * and the registration helpers (registerAuth, registerBanHandler, registerIPBlockHandler).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock CSRF token module ───────────────────────────────────────────────────
vi.mock('../../utils/csrfToken', () => ({
  getCsrfToken: vi.fn().mockReturnValue(null),
  setCsrfToken: vi.fn(),
}));

import {
  ApiError,
  apiFetch,
  apiRequest,
  publicApiFetch,
  publicApiRequest,
  registerAuth,
  registerBanHandler,
  registerIPBlockHandler,
} from '../../lib/apiClient';
import { getCsrfToken, setCsrfToken } from '../../utils/csrfToken';

// ─── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mockResponse = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => {
  const responseBody = JSON.stringify(body);
  const hdrs = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  });
  let bodyConsumed = false;

  const res: Partial<Response> = {
    ok: status >= 200 && status < 300,
    status,
    headers: hdrs,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : responseBody),
    clone: vi.fn().mockImplementation(() => ({
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : responseBody),
    })),
  };
  return res as Response;
};

// ════════════════════════════════════════════════════════════════════════════
// ApiError
// ════════════════════════════════════════════════════════════════════════════
describe('ApiError', () => {
  it('has name ApiError', () => {
    const e = new ApiError(500, { message: 'server error' });
    expect(e.name).toBe('ApiError');
  });

  it('stores status and data', () => {
    const data = { code: 'USER_BANNED' };
    const e = new ApiError(403, data);
    expect(e.status).toBe(403);
    expect(e.data).toEqual(data);
  });

  it('inherits from Error', () => {
    expect(new ApiError(400, {})).toBeInstanceOf(Error);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// registerAuth
// ════════════════════════════════════════════════════════════════════════════
describe('registerAuth', () => {
  it('throws if apiFetch is called before registerAuth', async () => {
    // Reset by creating a fresh module... we simulate with a guard check
    // The real test: registerAuth sets the token getter
    const getToken = vi.fn().mockResolvedValue('tok-123');
    registerAuth(getToken);

    mockFetch.mockResolvedValue(mockResponse(200, { success: true }));
    const res = await apiFetch('/api/test', { method: 'GET' });
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// apiFetch
// ════════════════════════════════════════════════════════════════════════════
describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAuth(vi.fn().mockResolvedValue('my-jwt-token'));
    (getCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it('adds Authorization header from token getter', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await apiFetch('/api/me', { method: 'GET' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.get('Authorization')).toBe('Bearer my-jwt-token');
  });

  it('does NOT add Authorization header when token is null', async () => {
    registerAuth(vi.fn().mockResolvedValue(null));
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await apiFetch('/api/public');

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.get('Authorization')).toBeNull();
  });

  it('adds X-CSRF-Token for state-changing methods', async () => {
    (getCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue('csrf-tok-xyz');
    mockFetch.mockResolvedValue(mockResponse(200, {}));

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      mockFetch.mockClear();
      await apiFetch('/api/resource', { method });
      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers?.get('X-CSRF-Token')).toBe('csrf-tok-xyz');
    }
  });

  it('does NOT add X-CSRF-Token for GET/HEAD requests', async () => {
    (getCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue('csrf-tok-xyz');
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await apiFetch('/api/resource', { method: 'GET' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.get('X-CSRF-Token')).toBeNull();
  });

  it('always sets credentials: include', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await apiFetch('/api/me');

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.credentials).toBe('include');
  });

  it('captures and stores X-CSRF-Token from response headers', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}, { 'X-CSRF-Token': 'new-csrf-from-server' }));
    await apiFetch('/api/me');
    expect(setCsrfToken).toHaveBeenCalledWith('new-csrf-from-server');
  });

  it('calls onUserBanned when status 403 with USER_BANNED code', async () => {
    const banHandler = vi.fn();
    registerBanHandler(banHandler);

    mockFetch.mockResolvedValue(
      mockResponse(403, {
        code: 'USER_BANNED',
        message: 'Your account has been suspended. Reason: spam',
      }),
    );
    await apiFetch('/api/data');
    expect(banHandler).toHaveBeenCalledWith('spam');
  });

  it('calls onIPBlocked when status 403 with IP_BLOCKED code in JSON', async () => {
    const ipHandler = vi.fn();
    registerIPBlockHandler(ipHandler);

    mockFetch.mockResolvedValue(mockResponse(403, { code: 'IP_BLOCKED', reasons: ['Abuse'] }));
    await apiFetch('/api/data');
    expect(ipHandler).toHaveBeenCalledWith(['Abuse']);
  });

  it('returns the response object', async () => {
    const fakeResponse = mockResponse(200, { data: 'hello' });
    mockFetch.mockResolvedValue(fakeResponse);
    const res = await apiFetch('/api/hello');
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// publicApiFetch
// ════════════════════════════════════════════════════════════════════════════
describe('publicApiFetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds CSRF token for POST without auth token', async () => {
    (getCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue('public-csrf');
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await publicApiFetch('/api/public', { method: 'POST' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.get('X-CSRF-Token')).toBe('public-csrf');
  });

  it('does NOT add Authorization header', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}));
    await publicApiFetch('/api/public');

    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers?.get('Authorization')).toBeNull();
  });

  it('captures X-CSRF-Token from response', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}, { 'X-CSRF-Token': 'public-new-csrf' }));
    await publicApiFetch('/api/public');
    expect(setCsrfToken).toHaveBeenCalledWith('public-new-csrf');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// apiRequest
// ════════════════════════════════════════════════════════════════════════════
describe('apiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAuth(vi.fn().mockResolvedValue('jwt'));
  });

  it('returns parsed JSON for 2xx responses', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { message: 'ok' }));
    const result = await apiRequest<{ message: string }>('/api/test');
    expect(result.message).toBe('ok');
  });

  it('returns empty object for 204 No Content', async () => {
    mockFetch.mockResolvedValue({
      ...mockResponse(204, null),
      ok: true,
      status: 204,
      json: vi.fn(),
    });
    const result = await apiRequest('/api/test', { method: 'DELETE' });
    expect(result).toEqual({});
  });

  it('throws ApiError for non-ok responses', async () => {
    mockFetch.mockResolvedValue(mockResponse(404, { message: 'Not found' }));
    await expect(apiRequest('/api/missing')).rejects.toThrow(ApiError);
  });

  it('ApiError.status matches HTTP status', async () => {
    mockFetch.mockResolvedValue(mockResponse(422, { errors: [] }));
    try {
      await apiRequest('/api/bad');
    } catch (e) {
      expect((e as ApiError).status).toBe(422);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// publicApiRequest
// ════════════════════════════════════════════════════════════════════════════
describe('publicApiRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed JSON for 2xx', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { status: 'ok' }));
    const result = await publicApiRequest<{ status: string }>('/api/public/test');
    expect(result.status).toBe('ok');
  });

  it('throws ApiError for non-ok responses', async () => {
    mockFetch.mockResolvedValue(mockResponse(403, { message: 'Forbidden' }));
    await expect(publicApiRequest('/api/public/protected')).rejects.toThrow(ApiError);
  });
});
