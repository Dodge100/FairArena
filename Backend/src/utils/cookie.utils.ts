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

import { CookieOptions } from 'express';
import { ENV } from '../config/env.js';

/**
 * Base cookie options for security
 */
export const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  ...(ENV.NODE_ENV === 'production' && ENV.COOKIE_DOMAIN
    ? {
        domain: ENV.COOKIE_DOMAIN,
      }
    : {}),
};

/**
 * Cookie options for Refresh Tokens (Long-lived)
 */
export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * Cookie options for Session Tokens (Short-lived)
 * Used for active_session tracking
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (matching refresh token for convenience in this arch)
};

/**
 * Cookie options for MFA Sessions (Very short-lived)
 */
export const MFA_SESSION_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_COOKIE_OPTIONS,
  maxAge: 5 * 60 * 1000, // 5 minutes
};

/**
 * Helper to get options for clearing a cookie
 */
export const getCookieClearOptions = (): CookieOptions => ({
  ...BASE_COOKIE_OPTIONS,
  maxAge: 0, // Expire immediately
});

/**
 * Cookie options for account settings tokens (short-lived)
 * @param expiryMinutes - Expiry time in minutes
 */
export const getAccountSettingsCookieOptions = (expiryMinutes: number): CookieOptions => ({
  ...BASE_COOKIE_OPTIONS,
  maxAge: expiryMinutes * 60 * 1000,
});
