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

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../config/database.js';
import { ENV } from '../../../config/env.js';
import { getOAuthProvider } from '../../../config/oauth.providers.js';
import {
  exchangeOAuthToken,
  fetchOAuthUserInfo,
  findOrCreateOAuthUser,
  generateOAuthUrl,
  handleOAuthMfaFlow,
} from '../../../services/oauth.service.js';

vi.mock('../../../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../config/env.js', () => ({
  ENV: {
    FRONTEND_URL: 'https://app.fairarena.com',
    JWT_SECRET: 'test-secret',
    NEW_SIGNUP_ENABLED: true,
  },
}));

vi.mock('../../../config/oauth.providers.js', () => ({
  getOAuthProvider: vi.fn(),
}));

vi.mock('../../../services/auth.service.js', () => ({
  createSession: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  generateBindingToken: vi.fn().mockReturnValue({ token: 'bound', hash: 'hash' }),
  storeSessionBinding: vi.fn(),
  parseUserAgent: vi.fn().mockReturnValue({ deviceType: 'desktop', deviceName: 'Chrome' }),
}));

vi.mock('../../../utils/email.utils.js', () => ({
  normalizeEmail: vi.fn((email) => email.toLowerCase()),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('OAuth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeOAuthToken', () => {
    it('uses standard OAuth 2.0 exchange when no custom exchange is provided', async () => {
      const provider = {
        name: 'google',
        displayName: 'Google',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        callbackUrl: 'callback',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'abc', id_token: 'id123' }),
      });

      const result = await exchangeOAuthToken(provider as any, 'code123');
      expect(result).toEqual({ accessToken: 'abc', idToken: 'id123' });
      expect(global.fetch).toHaveBeenCalledWith(
        provider.tokenUrl,
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('throws error when token exchange fails', async () => {
      const provider = {
        name: 'google',
        displayName: 'Google',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
      });

      await expect(exchangeOAuthToken(provider as any, 'code123')).rejects.toThrow(
        'GOOGLE_TOKEN_FAILED',
      );
    });
  });

  describe('fetchOAuthUserInfo', () => {
    it('calls userInfoUrl with Bearer token', async () => {
      const provider = {
        name: 'github',
        displayName: 'GitHub',
        userInfoUrl: 'https://api.github.com/user',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', email: 'test@example.com' }),
      });

      const result = await fetchOAuthUserInfo(provider as any, 'token123');
      expect(result).toEqual({ id: '123', email: 'test@example.com' });
      expect(global.fetch).toHaveBeenCalledWith(
        provider.userInfoUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        }),
      );
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('finds existing user by email', async () => {
      const oauthData = {
        email: 'alice@example.com',
        providerName: 'google',
        firstName: 'Alice',
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce({
        userId: 'u1',
        email: 'alice@example.com',
      });

      const user = await findOrCreateOAuthUser(oauthData as any);
      expect(user.userId).toBe('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates new user if not found', async () => {
      const oauthData = {
        email: 'bob@example.com',
        providerName: 'google',
        firstName: 'Bob',
        lastName: 'Jones',
        profileImageUrl: 'img',
        emailVerified: true,
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(null);
      (prisma.user.create as any).mockResolvedValueOnce({ userId: 'u2', email: 'bob@example.com' });

      const user = await findOrCreateOAuthUser(oauthData as any);
      expect(user.userId).toBe('u2');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'bob@example.com',
            firstName: 'Bob',
          }),
        }),
      );
    });

    it('throws error if signup is disabled and user not found', async () => {
      ENV.NEW_SIGNUP_ENABLED = false;
      const oauthData = { email: 'new@example.com', providerName: 'google' };
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);

      await expect(findOrCreateOAuthUser(oauthData as any)).rejects.toThrow('SIGNUP_DISABLED');
      ENV.NEW_SIGNUP_ENABLED = true; // reset
    });
  });

  describe('handleOAuthMfaFlow', () => {
    it('returns false if MFA is not enabled', async () => {
      const user = { userId: 'u1', mfaEnabled: false };
      const req = {} as Request;
      const res = {} as Response;
      const result = await handleOAuthMfaFlow(user, req, res, '/dash');
      expect(result).toBe(false);
    });

    it('initiates MFA flow if enabled', async () => {
      const user = { userId: 'u1', mfaEnabled: true };
      const req = {
        headers: { 'user-agent': 'chrome' },
        ip: '127.0.0.1',
      } as unknown as Request;
      const res = {
        cookie: vi.fn(),
        redirect: vi.fn(),
      } as unknown as Response;

      const result = await handleOAuthMfaFlow(user, req, res, '/dash');
      expect(result).toBe(true);
      expect(res.cookie).toHaveBeenCalledWith(
        'mfa_session',
        expect.any(String),
        expect.any(Object),
      );
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('mfa=required'));
    });
  });

  describe('generateOAuthUrl', () => {
    it('generates a valid URL with required parameters', () => {
      const provider = {
        name: 'google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId: 'cid',
        callbackUrl: 'curl',
        scopes: ['email', 'profile'],
      };
      (getOAuthProvider as any).mockReturnValue(provider);

      const urlString = generateOAuthUrl('google', '/home');
      const url = new URL(urlString);

      expect(url.origin + url.pathname).toBe(provider.authUrl);
      expect(url.searchParams.get('client_id')).toBe('cid');
      expect(url.searchParams.get('redirect_uri')).toBe('curl');
      expect(url.searchParams.get('state')).toBe('/home');
      expect(url.searchParams.get('scope')).toBe('email profile');
    });
  });
});
