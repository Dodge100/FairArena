/**
 * OAuth Application Management Controller
 *
 * Allows users to create, manage, and delete their OAuth applications.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  logOAuthEvent,
} from '../../services/oauthProvider.service.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional(),
  privacyPolicyUrl: z.string().url().optional(),
  termsOfServiceUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).min(1).max(10),
  isPublic: z.boolean().optional().default(false),
  grantTypes: z
    .array(
      z.enum([
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:device_code',
      ]),
    )
    .optional()
    .default([
      'authorization_code',
      'refresh_token',
      'urn:ietf:params:oauth:grant-type:device_code',
    ]),
});

const updateApplicationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  privacyPolicyUrl: z.string().url().optional().nullable(),
  termsOfServiceUrl: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  redirectUris: z.array(z.string().url()).min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// CONTROLLERS
// ============================================

/**
 * List user's OAuth applications
 * GET /oauth/applications
 */
export async function listApplications(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const applications = await prisma.oAuthApplication.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      clientId: true,
      name: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      privacyPolicyUrl: true,
      termsOfServiceUrl: true,
      redirectUris: true,
      isPublic: true,
      isActive: true,
      isVerified: true,
      verificationStatus: true,
      isTrusted: true,
      grantTypes: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          consents: { where: { revokedAt: null } },
          accessTokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    applications: applications.map((app) => ({
      ...app,
      activeUsers: app._count.consents,
      activeTokens: app._count.accessTokens,
      _count: undefined,
    })),
  });
}

/**
 * Create a new OAuth application
 * POST /oauth/applications
 */
export async function createApplication(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const validation = createApplicationSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues,
    });
    return;
  }

  const data = validation.data;

  // Check application limit (prevent abuse)
  const existingCount = await prisma.oAuthApplication.count({
    where: { ownerId: userId },
  });

  if (existingCount >= 20) {
    res.status(400).json({
      error: 'Application limit reached',
      message: 'You can have a maximum of 20 OAuth applications',
    });
    return;
  }

  // Generate credentials
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const clientSecretHash = await hashClientSecret(clientSecret);

  // Determine default scopes based on client type
  const defaultScopes = ['openid', 'profile', 'email'];
  if (data.grantTypes?.includes('authorization_code')) {
    defaultScopes.push('offline_access');
  }

  // Public clients can't use client_credentials
  const grantTypes = data.isPublic
    ? data.grantTypes?.filter((g) => g !== 'client_credentials') || [
        'authorization_code',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code',
      ]
    : data.grantTypes;

  const application = await prisma.oAuthApplication.create({
    data: {
      clientId,
      clientSecretHash: data.isPublic ? null : clientSecretHash,
      name: data.name,
      description: data.description,
      websiteUrl: data.websiteUrl,
      privacyPolicyUrl: data.privacyPolicyUrl,
      termsOfServiceUrl: data.termsOfServiceUrl,
      logoUrl: data.logoUrl,
      redirectUris: data.redirectUris,
      allowedScopes: defaultScopes,
      allowedAudiences: [],
      grantTypes,
      responseTypes: ['code'],
      tokenEndpointAuthMethod: data.isPublic ? 'none' : 'client_secret_basic,client_secret_post',
      isPublic: data.isPublic || false,
      isConfidential: !data.isPublic,
      requirePkce: true, // Always require PKCE
      isActive: true,
      isVerified: false,
      isTrusted: false,
      ownerId: userId,
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      redirectUris: true,
      allowedScopes: true,
      grantTypes: true,
      isPublic: true,
      isActive: true,
      createdAt: true,
    },
  });

  await logOAuthEvent('application_created', {
    applicationId: application.id,
    userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { name: data.name, isPublic: data.isPublic },
  });

  // Return client secret ONLY on creation (never shown again)
  res.status(201).json({
    application,
    clientSecret: data.isPublic ? null : clientSecret,
    message: data.isPublic
      ? 'Public client created. No client secret needed.'
      : 'IMPORTANT: Save the client secret now. It will not be shown again.',
  });
}

/**
 * Get OAuth application details
 * GET /oauth/applications/:id
 */
export async function getApplication(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const application = await prisma.oAuthApplication.findFirst({
    where: { id: id as string, ownerId: userId },
    select: {
      id: true,
      clientId: true,
      name: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      privacyPolicyUrl: true,
      termsOfServiceUrl: true,
      redirectUris: true,
      allowedScopes: true,
      grantTypes: true,
      responseTypes: true,
      tokenEndpointAuthMethod: true,
      isPublic: true,
      isConfidential: true,
      requirePkce: true,
      isActive: true,
      isVerified: true,
      verificationStatus: true,
      verificationSubmittedAt: true,
      verificationVerifiedAt: true,
      verificationRejectionReason: true,
      isTrusted: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          consents: { where: { revokedAt: null } },
          accessTokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
          refreshTokens: {
            where: { revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() } },
          },
        },
      },
    },
  });

  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json({
    application: {
      ...application,
      stats: {
        activeUsers: application._count.consents,
        activeAccessTokens: application._count.accessTokens,
        activeRefreshTokens: application._count.refreshTokens,
      },
      _count: undefined,
    },
  });
}

/**
 * Update OAuth application
 * PATCH /oauth/applications/:id
 */
export async function updateApplication(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const validation = updateApplicationSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues,
    });
    return;
  }

  // Verify ownership
  const existing = await prisma.oAuthApplication.findFirst({
    where: { id: id as string, ownerId: userId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const data = validation.data;

  const application = await prisma.oAuthApplication.update({
    where: { id: id as string },
    data: {
      name: data.name,
      description: data.description,
      websiteUrl: data.websiteUrl,
      privacyPolicyUrl: data.privacyPolicyUrl,
      termsOfServiceUrl: data.termsOfServiceUrl,
      logoUrl: data.logoUrl,
      redirectUris: data.redirectUris,
      isActive: data.isActive,
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      redirectUris: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await logOAuthEvent('application_updated', {
    applicationId: id as string,
    userId,
    ipAddress: req.ip,
    metadata: { changes: Object.keys(data) },
  });

  res.json({ application });
}

/**
 * Delete OAuth application
 * DELETE /oauth/applications/:id
 */
export async function deleteApplication(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Verify ownership
  const existing = await prisma.oAuthApplication.findFirst({
    where: { id: id as string, ownerId: userId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  // Delete cascades to all related tokens and consents
  await prisma.oAuthApplication.delete({
    where: { id: id as string },
  });

  await logOAuthEvent('application_deleted', {
    userId,
    ipAddress: req.ip,
    metadata: { applicationId: id, name: existing.name },
  });

  res.status(204).send();
}

/**
 * Regenerate client secret
 * POST /oauth/applications/:id/secret
 */
export async function regenerateSecret(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Verify ownership
  const existing = await prisma.oAuthApplication.findFirst({
    where: { id: id as string, ownerId: userId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (existing.isPublic) {
    res.status(400).json({
      error: 'Invalid operation',
      message: 'Public clients do not have a client secret',
    });
    return;
  }

  // Generate new secret
  const clientSecret = generateClientSecret();
  const clientSecretHash = await hashClientSecret(clientSecret);

  await prisma.oAuthApplication.update({
    where: { id: id as string },
    data: { clientSecretHash },
  });

  // Revoke all existing refresh tokens (security measure)
  await prisma.oAuthRefreshToken.updateMany({
    where: { applicationId: id as string, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logOAuthEvent('client_secret_regenerated', {
    applicationId: id as string,
    userId,
    ipAddress: req.ip,
    metadata: { refreshTokensRevoked: true },
  });

  res.json({
    clientSecret,
    message:
      'IMPORTANT: Save the new client secret now. It will not be shown again. All existing refresh tokens have been revoked.',
  });
}

/**
 * Submit application for verification
 * POST /oauth/applications/:id/verify
 */
export async function verifyApplication(req: Request, res: Response): Promise<void> {
  const userId = (req as unknown as { user?: { userId: string } }).user?.userId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const existing = await prisma.oAuthApplication.findFirst({
    where: { id: id as string, ownerId: userId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (existing.verificationStatus === 'pending' || existing.verificationStatus === 'verified') {
    res.status(400).json({ error: 'Application is already pending verification or verified' });
    return;
  }

  // Update status
  await prisma.oAuthApplication.update({
    where: { id: id as string },
    data: {
      verificationStatus: 'pending',
      verificationSubmittedAt: new Date(),
    },
  });

  await logOAuthEvent('application_verification_submitted', {
    applicationId: id as string,
    userId,
    ipAddress: req.ip,
    metadata: { status: 'pending' },
  });

  res.json({ success: true, message: 'Verification request submitted' });
}

/**
 * Get application public info (for consent screen)
 * GET /oauth/applications/:clientId/public
 */
export async function getApplicationPublicInfo(req: Request, res: Response): Promise<void> {
  const { clientId } = req.params;

  const application = await prisma.oAuthApplication.findUnique({
    where: { clientId: clientId as string, isActive: true },
    select: {
      name: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      privacyPolicyUrl: true,
      termsOfServiceUrl: true,
      isVerified: true,
      verificationStatus: true,
    },
  });

  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json({ application });
}
