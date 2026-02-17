import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { parseBasicAuth, verifyClientSecret } from '../services/oauthProvider.service.js';
import logger from '../utils/logger.js';

// Extend Express Request to include OAuth client
declare global {
  namespace Express {
    interface Request {
      oauthClient?: {
        id: string;
        clientId: string;
        name: string;
        isPublic: boolean;
        isConfidential: boolean;
        allowedScopes: string[];
        allowedAudiences: string[];
        grantTypes: string[];
        redirectUris: string[];
        requirePkce: boolean;
        isVerified: boolean;
        isTrusted: boolean;
        ownerId: string;
      };
    }
  }
}

/**
 * Authenticate OAuth client for token endpoint
 * Supports: client_secret_basic, client_secret_post, none (public clients)
 */
export async function oauthClientAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let authMethod: 'client_secret_basic' | 'client_secret_post' | 'none' = 'none';

  // Try Basic authentication header first
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parsed = parseBasicAuth(authHeader);
    if (parsed) {
      clientId = parsed.clientId;
      clientSecret = parsed.clientSecret;
      authMethod = 'client_secret_basic';
    }
  }

  // Fall back to POST body parameters
  if (!clientId) {
    clientId = req.body?.client_id;
    if (req.body?.client_secret) {
      clientSecret = req.body.client_secret;
      authMethod = 'client_secret_post';
    }
  }

  if (!clientId) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required',
    });
    return;
  }

  // Look up the application
  const application = await prisma.oAuthApplication.findUnique({
    where: { clientId, isActive: true },
  });

  if (!application) {
    logger.warn('OAuth client not found', { clientId });
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Unknown client',
    });
    return;
  }

  // Validate client authentication method
  const allowedMethods = application.tokenEndpointAuthMethod.split(',').map((m) => m.trim());
  if (!allowedMethods.includes(authMethod) && authMethod !== 'none') {
    res.status(401).json({
      error: 'invalid_client',
      error_description: `Client authentication method '${authMethod}' not allowed`,
    });
    return;
  }

  // Confidential clients MUST provide credentials
  if (application.isConfidential) {
    if (!clientSecret) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client secret required for confidential clients',
      });
      return;
    }

    if (!application.clientSecretHash) {
      logger.error('Confidential client missing secret hash', { clientId });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Client configuration error',
      });
      return;
    }

    const isValid = await verifyClientSecret(clientSecret, application.clientSecretHash);
    if (!isValid) {
      logger.warn('Invalid client secret', { clientId });
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
      return;
    }
  }

  // Attach client to request
  req.oauthClient = {
    id: application.id,
    clientId: application.clientId,
    name: application.name,
    isPublic: application.isPublic,
    isConfidential: application.isConfidential,
    allowedScopes: application.allowedScopes,
    allowedAudiences: application.allowedAudiences,
    grantTypes: application.grantTypes,
    redirectUris: application.redirectUris,
    requirePkce: application.requirePkce,
    isVerified: application.isVerified,
    isTrusted: application.isTrusted,
    ownerId: application.ownerId,
  };

  next();
}

/**
 * Require confidential client (for introspection, etc.)
 */
export function requireConfidentialClient(req: Request, res: Response, next: NextFunction): void {
  if (!req.oauthClient) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required',
    });
    return;
  }

  if (!req.oauthClient.isConfidential) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Only confidential clients can access this endpoint',
    });
    return;
  }

  next();
}
