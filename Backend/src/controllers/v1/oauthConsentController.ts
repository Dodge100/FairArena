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
 * OAuth Consent Management Controller
 *
 * Allows users to view and revoke their OAuth application authorizations.
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logOAuthEvent } from '../../services/oauthProvider.service.js';

/**
 * List user's authorized applications (consents)
 * GET /oauth/consents
 */
export async function listConsents(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const consents = await prisma.oAuthConsent.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    include: {
      application: {
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          logoUrl: true,
          websiteUrl: true,
          isVerified: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({
    consents: consents.map((consent) => ({
      id: consent.id,
      application: consent.application,
      grantedScopes: consent.grantedScopes,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
    })),
  });
}

/**
 * Get consent details for an application
 * GET /oauth/consents/:applicationId
 */
export async function getConsent(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { applicationId } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const consent = await prisma.oAuthConsent.findUnique({
    where: {
      userId_applicationId: { userId, applicationId: applicationId as string },
    },
    include: {
      application: {
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          logoUrl: true,
          websiteUrl: true,
          privacyPolicyUrl: true,
          termsOfServiceUrl: true,
          isVerified: true,
        },
      },
    },
  });

  if (!consent) {
    res.status(404).json({ error: 'Consent not found' });
    return;
  }

  // Get scope details
  const scopeDetails = await prisma.oAuthScope.findMany({
    where: { name: { in: consent.grantedScopes } },
    select: {
      name: true,
      displayName: true,
      description: true,
    },
  });

  // Standard OIDC scope descriptions
  const oidcScopeDescriptions: Record<string, { displayName: string; description: string }> = {
    openid: { displayName: 'OpenID', description: 'Verify your identity' },
    profile: { displayName: 'Profile', description: 'Access your profile information' },
    email: { displayName: 'Email', description: 'Access your email address' },
    offline_access: {
      displayName: 'Offline Access',
      description: 'Access your data when you are not present',
    },
  };

  const scopes = consent.grantedScopes.map((name) => {
    const dbScope = scopeDetails.find((s) => s.name === name);
    const oidcScope = oidcScopeDescriptions[name];
    return {
      name,
      displayName: dbScope?.displayName || oidcScope?.displayName || name,
      description: dbScope?.description || oidcScope?.description || '',
    };
  });

  // Get active tokens count
  const activeTokensCount = await prisma.oAuthAccessToken.count({
    where: {
      applicationId: applicationId as string,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  res.json({
    consent: {
      id: consent.id,
      application: consent.application,
      grantedScopes: scopes,
      scopeHistory: consent.scopeHistory,
      activeTokens: activeTokensCount,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
      revokedAt: consent.revokedAt,
    },
  });
}

/**
 * Revoke consent for an application
 * DELETE /oauth/consents/:applicationId
 */
export async function revokeConsent(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { applicationId } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const consent = await prisma.oAuthConsent.findUnique({
    where: {
      userId_applicationId: { userId, applicationId: applicationId as string },
    },
  });

  if (!consent) {
    res.status(404).json({ error: 'Consent not found' });
    return;
  }

  if (consent.revokedAt) {
    res.status(400).json({ error: 'Consent already revoked' });
    return;
  }

  // Revoke consent and all tokens in a transaction
  await prisma.$transaction([
    // Mark consent as revoked
    prisma.oAuthConsent.update({
      where: { id: consent.id },
      data: { revokedAt: new Date() },
    }),
    // Revoke all access tokens
    prisma.oAuthAccessToken.updateMany({
      where: { applicationId: applicationId as string, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    // Revoke all refresh tokens
    prisma.oAuthRefreshToken.updateMany({
      where: { applicationId: applicationId as string, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logOAuthEvent('consent_revoked', {
    applicationId: applicationId as string,
    userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(204).send();
}

/**
 * List all active sessions (tokens) for a user across all apps
 * GET /oauth/sessions
 */
export async function listOAuthSessions(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const accessTokens = await prisma.oAuthAccessToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      application: {
        select: {
          id: true,
          clientId: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({
    sessions: accessTokens.map((token) => ({
      id: token.id,
      application: token.application,
      scope: token.scope,
      grantType: token.grantType,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
    })),
  });
}

/**
 * Revoke a specific OAuth session (access token)
 * DELETE /oauth/sessions/:tokenId
 */
export async function revokeOAuthSession(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { tokenId } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = await prisma.oAuthAccessToken.findFirst({
    where: { id: tokenId as string, userId },
  });

  if (!token) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await prisma.oAuthAccessToken.update({
    where: { id: tokenId as string },
    data: { revokedAt: new Date() },
  });

  await logOAuthEvent('session_revoked', {
    applicationId: token.applicationId,
    userId,
    ipAddress: req.ip,
  });

  res.status(204).send();
}
