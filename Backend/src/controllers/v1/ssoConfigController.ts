import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { inngest } from '../../inngest/v1/client.js';
import {
  createVerificationRecord,
  generateVerificationToken,
  verifyDomainOwnership,
} from '../../services/dnsVerification.service.js';
import { encryptSecret } from '../../services/encryption.service.js';
import logger from '../../utils/logger.js';

// Schemas
const ssoConfigSchema = z.object({
  domain: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
  providerType: z.enum(['oidc', 'saml']).default('oidc'),
  issuerUrl: z.string().url(),
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  userInfoUrl: z.string().url().optional(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1).optional(), // Optional on update if preserving
  scimEnabled: z.boolean().default(false),
  isActive: z.boolean().default(false),
});

/**
 * Get SSO Config for Organization
 * GET /api/v1/organization/:orgId/sso-config
 */
export const getSSOConfig = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    // Check Permissions (Admin only)
    const membership = await prisma.organizationUserRole.findFirst({
      where: {
        userId,
        organizationId,
        role: { roleName: { in: ['Admin', 'Owner'] } },
      },
    });

    // Also allow Owner by checking Organization relation? Or just stick to explicit roles.
    // Usually Owners have Admin role.
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const config = await prisma.organizationSSOConfig.findUnique({
      where: { organizationId },
    });

    if (!config) {
      return res.json({ success: true, data: null });
    }

    // Mask clientSecret and scimToken
    res.json({
      success: true,
      data: {
        ...config,
        clientSecret: config.clientSecret ? '********' : null,
        scimToken: config.scimToken ? config.scimToken : null,
      },
    });
  } catch (error) {
    logger.error('Get SSO Config error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Upsert SSO Config (Create or Update)
 * POST /api/v1/organization/:orgId/sso-config
 */
export const upsertSSOConfig = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    // Check Permissions
    const membership = await prisma.organizationUserRole.findFirst({
      where: { userId, organizationId, role: { roleName: { in: ['Admin', 'Owner'] } } },
    });
    if (!membership) return res.status(403).json({ success: false, message: 'Forbidden' });

    // Validate Body
    const validation = ssoConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, errors: validation.error.format() });
    }

    const data = validation.data;

    // Security: Block public domains
    const FORBIDDEN_DOMAINS = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
      'live.com',
      'me.com',
      'msn.com',
      'googlemail.com',
      'yandex.com',
      'mail.ru',
      'zohomail.in',
    ];

    if (FORBIDDEN_DOMAINS.includes(data.domain.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message:
          'Security Error: Cannot enable SSO for public email domains. Please use a custom corporate domain.',
      });
    }

    // Check if domain is already claimed by another organization
    const existingConfig = await prisma.organizationSSOConfig.findFirst({
      where: {
        domain: data.domain,
        organizationId: { not: organizationId }, // Exclude current org
      },
    });

    if (existingConfig) {
      return res.status(409).json({
        success: false,
        message: 'This domain is already verified and claimed by another organization.',
      });
    }

    // Security: Prevent activation without verification
    if (data.isActive) {
      const currentConfig = await prisma.organizationSSOConfig.findUnique({
        where: { organizationId },
      });

      if (!currentConfig?.domainVerified) {
        return res.status(403).json({
          success: false,
          message:
            'Cannot activate SSO without domain verification. Please verify domain ownership first.',
        });
      }
    }

    // Handle encryption
    const updateData: any = {
      domain: data.domain,
      providerType: data.providerType,
      issuerUrl: data.issuerUrl,
      authorizationUrl: data.authorizationUrl,
      tokenUrl: data.tokenUrl,
      userInfoUrl: data.userInfoUrl,
      clientId: data.clientId,
      scimEnabled: data.scimEnabled,
      isActive: data.isActive,
    };

    if (data.clientSecret) {
      updateData.clientSecret = encryptSecret(data.clientSecret);
    }

    // Upsert
    const config = await prisma.organizationSSOConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...updateData,
        // Generate SCIM token if enabled and new? Or wait for regenerate call
      },
      update: updateData,
    });

    // Log Audit
    await inngest.send({
      name: 'log.create',
      data: {
        userId: userId!,
        organizationId: orgId,
        action: 'sso_config_update',
        level: 'INFO',
        metadata: { domain: data.domain },
      },
    });

    res.json({ success: true, data: { ...config, clientSecret: '********' } });
  } catch (error) {
    logger.error('Upsert SSO Config error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Regenerate SCIM Token
 * POST /api/v1/organization/:orgId/sso-config/scim-token
 */
export const regenerateSCIMToken = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    const membership = await prisma.organizationUserRole.findFirst({
      where: { userId, organizationId, role: { roleName: { in: ['Admin', 'Owner'] } } },
    });
    if (!membership) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { createId } = await import('@paralleldrive/cuid2');
    const newToken = `scim_${createId()}${createId()}`; // Long random string

    // Encrypt? SCIM tokens are usually handled like API keys.
    // We'll encrypt it for storage.
    const encrypted = encryptSecret(newToken);

    await prisma.organizationSSOConfig.update({
      where: { organizationId },
      data: { scimToken: encrypted },
    });

    // Log Audit
    await inngest.send({
      name: 'log.create',
      data: {
        userId: userId!,
        organizationId: orgId,
        action: 'scim_token_regenerate',
        level: 'WARN',
        metadata: {},
      },
    });

    // Return plaintext token ONCE (ONLY TIME IT'LL BE SHOWN)
    res.json({ success: true, token: newToken });
  } catch (error) {
    logger.error('Regenerate SCIM token error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Test SSO Connection
 * POST /api/v1/organization/:orgId/sso-config/test
 */
export const testSSOConnection = async (req: Request, res: Response) => {
  // Logic to initiate a backstage OIDC discovery/ping or just return config validation
  // Real testing usually requires browser interaction flow.
  // For now, simple URL validation or Metadata fetch.
  try {
    const { orgId } = req.params;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;
    const config = await prisma.organizationSSOConfig.findUnique({ where: { organizationId } });

    if (!config || !config.issuerUrl)
      return res.status(400).json({ success: false, message: 'No config' });

    // Try fetching OIDC discovery
    const discoveryUrl = config.issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
    try {
      const discRes = await fetch(discoveryUrl);
      if (!discRes.ok) throw new Error('Failed to fetch discovery');
      const disc = await discRes.json();

      return res.json({ success: true, message: 'OIDC Discovery successful', discovery: disc });
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, message: 'Could not connect to Provider. Check Issuer URL.' });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Test failed' });
  }
};

/**
 * Initiate Domain Verification
 * POST /api/v1/organization/:orgId/sso-config/verify-domain/initiate
 */
export const initiateDomainVerification = async (req: Request, res: Response) => {
  console.log('Initiating domain verification for org:', req.params.orgId);
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    const membership = await prisma.organizationUserRole.findFirst({
      where: { userId, organizationId, role: { roleName: { in: ['Admin', 'Owner'] } } },
    });
    if (!membership) return res.status(403).json({ success: false, message: 'Forbidden' });

    const ssoConfig = await prisma.organizationSSOConfig.findUnique({
      where: { organizationId },
    });

    if (!ssoConfig) {
      return res.status(404).json({
        success: false,
        message: 'SSO configuration not found. Please configure SSO settings first.',
      });
    }

    // Generate new verification token
    const token = generateVerificationToken();

    await prisma.organizationSSOConfig.update({
      where: { organizationId },
      data: {
        domainVerificationToken: token,
        domainVerificationAttempts: 0,
        domainVerified: false,
        domainVerifiedAt: null,
      },
    });

    const txtRecord = createVerificationRecord(token);
    const recordName = `_fairarena-verify.${ssoConfig.domain}`;

    res.json({
      success: true,
      data: {
        domain: ssoConfig.domain,
        recordName,
        recordType: 'TXT',
        recordValue: txtRecord,
        instructions: [
          `Go to your DNS provider (e.g., Cloudflare, GoDaddy, AWS Route53)`,
          `Add a new TXT record:`,
          `  Name/Host: ${recordName}`,
          `  Type: TXT`,
          `  Value: ${txtRecord}`,
          `Wait 5-10 minutes for DNS propagation`,
          `Click "Verify Domain" to complete verification`,
        ],
      },
    });
  } catch (error) {
    logger.error('Initiate domain verification error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Check Domain Verification
 * POST /api/v1/organization/:orgId/sso-config/verify-domain/check
 */
export const checkDomainVerification = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    const membership = await prisma.organizationUserRole.findFirst({
      where: { userId, organizationId, role: { roleName: { in: ['Admin', 'Owner'] } } },
    });
    if (!membership) return res.status(403).json({ success: false, message: 'Forbidden' });

    const ssoConfig = await prisma.organizationSSOConfig.findUnique({
      where: { organizationId },
    });

    if (!ssoConfig || !ssoConfig.domainVerificationToken) {
      return res.status(400).json({
        success: false,
        message: 'No verification token found. Please initiate domain verification first.',
      });
    }

    // Rate limiting: max 10 attempts
    if (ssoConfig.domainVerificationAttempts >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please wait 1 hour before trying again.',
      });
    }

    // Perform DNS verification
    const result = await verifyDomainOwnership(
      ssoConfig.domain!,
      ssoConfig.domainVerificationToken,
    );

    // Increment attempts
    await prisma.organizationSSOConfig.update({
      where: { organizationId },
      data: {
        domainVerificationAttempts: { increment: 1 },
      },
    });

    if (result.verified) {
      await prisma.organizationSSOConfig.update({
        where: { organizationId },
        data: {
          domainVerified: true,
          domainVerifiedAt: new Date(),
          domainVerificationExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          domainVerificationAttempts: 0,
        },
      });

      // Audit log
      await inngest.send({
        name: 'log.create',
        data: {
          userId: userId!,
          organizationId,
          action: 'sso_domain_verified',
          level: 'INFO',
          metadata: { domain: ssoConfig.domain },
        },
      });

      return res.json({
        success: true,
        message: 'Domain verified successfully! You can now activate SSO.',
        data: { verified: true, verifiedAt: new Date() },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error || 'Domain verification failed. Please check your DNS records.',
        data: {
          verified: false,
          attemptsRemaining: 10 - (ssoConfig.domainVerificationAttempts + 1),
        },
      });
    }
  } catch (error) {
    logger.error('Check domain verification error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get Verification Status
 * GET /api/v1/organization/:orgId/sso-config/verification-status
 */
export const getVerificationStatus = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const userId = req.user?.userId;
    const organizationId = Array.isArray(orgId) ? orgId[0] : orgId;

    const membership = await prisma.organizationUserRole.findFirst({
      where: { userId, organizationId, role: { roleName: { in: ['Admin', 'Owner'] } } },
    });
    if (!membership) return res.status(403).json({ success: false, message: 'Forbidden' });

    const ssoConfig = await prisma.organizationSSOConfig.findUnique({
      where: { organizationId },
    });

    if (!ssoConfig) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        domain: ssoConfig.domain,
        verified: ssoConfig.domainVerified,
        verifiedAt: ssoConfig.domainVerifiedAt,
        expiresAt: ssoConfig.domainVerificationExpiresAt,
        hasToken: !!ssoConfig.domainVerificationToken,
        attemptsUsed: ssoConfig.domainVerificationAttempts,
      },
    });
  } catch (error) {
    logger.error('Get verification status error', { error });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
