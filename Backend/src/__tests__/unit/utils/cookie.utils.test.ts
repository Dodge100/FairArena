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
 * cookie.utils.test.ts
 *
 * Unit tests for cookie option helpers:
 *   - BASE_COOKIE_OPTIONS       (security flags)
 *   - REFRESH_TOKEN_COOKIE_OPTIONS
 *   - SESSION_COOKIE_OPTIONS
 *   - MFA_SESSION_COOKIE_OPTIONS
 *   - getCookieClearOptions
 *   - getAccountSettingsCookieOptions
 *
 * ENV is mocked so we can test both production and non-production branches.
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock ENV ─────────────────────────────────────────────────────────────────
// Default: non-production environment
vi.mock('../../../config/env.js', () => ({
  ENV: {
    NODE_ENV: 'test',
    COOKIE_DOMAIN: undefined,
  },
}));

import {
  BASE_COOKIE_OPTIONS,
  getAccountSettingsCookieOptions,
  getCookieClearOptions,
  MFA_SESSION_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from '../../../utils/cookie.utils.js';

// ════════════════════════════════════════════════════════════════════════════
// BASE_COOKIE_OPTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('BASE_COOKIE_OPTIONS', () => {
  it('has httpOnly: true', () => {
    expect(BASE_COOKIE_OPTIONS.httpOnly).toBe(true);
  });

  it('has sameSite: strict', () => {
    expect(BASE_COOKIE_OPTIONS.sameSite).toBe('strict');
  });

  it('has path: /', () => {
    expect(BASE_COOKIE_OPTIONS.path).toBe('/');
  });

  it('is NOT secure in non-production (NODE_ENV=test)', () => {
    // The module is loaded with NODE_ENV=test mock
    expect(BASE_COOKIE_OPTIONS.secure).toBe(false);
  });

  it('does not include a domain in non-production', () => {
    expect(BASE_COOKIE_OPTIONS.domain).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REFRESH_TOKEN_COOKIE_OPTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('REFRESH_TOKEN_COOKIE_OPTIONS', () => {
  it('inherits all base options', () => {
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.sameSite).toBe('strict');
  });

  it('has a maxAge of 30 days in milliseconds', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.maxAge).toBe(thirtyDaysMs);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION_COOKIE_OPTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('SESSION_COOKIE_OPTIONS', () => {
  it('has a maxAge of 30 days in milliseconds', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(thirtyDaysMs);
  });

  it('inherits base security flags', () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MFA_SESSION_COOKIE_OPTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('MFA_SESSION_COOKIE_OPTIONS', () => {
  it('has a maxAge of 5 minutes in milliseconds', () => {
    const fiveMinutesMs = 5 * 60 * 1000;
    expect(MFA_SESSION_COOKIE_OPTIONS.maxAge).toBe(fiveMinutesMs);
  });

  it('is much shorter-lived than a refresh token', () => {
    expect(MFA_SESSION_COOKIE_OPTIONS.maxAge!).toBeLessThan(REFRESH_TOKEN_COOKIE_OPTIONS.maxAge!);
  });

  it('inherits base security flags', () => {
    expect(MFA_SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(MFA_SESSION_COOKIE_OPTIONS.sameSite).toBe('strict');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getCookieClearOptions
// ════════════════════════════════════════════════════════════════════════════
describe('getCookieClearOptions', () => {
  it('returns maxAge: 0 to immediately expire the cookie', () => {
    expect(getCookieClearOptions().maxAge).toBe(0);
  });

  it('preserves base security flags', () => {
    const opts = getCookieClearOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('strict');
  });

  it('returns a new object on each call (not shared reference)', () => {
    const a = getCookieClearOptions();
    const b = getCookieClearOptions();
    expect(a).not.toBe(b);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getAccountSettingsCookieOptions
// ════════════════════════════════════════════════════════════════════════════
describe('getAccountSettingsCookieOptions', () => {
  it('converts minutes to milliseconds correctly', () => {
    const opts = getAccountSettingsCookieOptions(15);
    expect(opts.maxAge).toBe(15 * 60 * 1000);
  });

  it('works for 5 minutes', () => {
    expect(getAccountSettingsCookieOptions(5).maxAge).toBe(5 * 60 * 1000);
  });

  it('works for 60 minutes', () => {
    expect(getAccountSettingsCookieOptions(60).maxAge).toBe(60 * 60 * 1000);
  });

  it('inherits base security flags', () => {
    const opts = getAccountSettingsCookieOptions(10);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('strict');
  });
});
