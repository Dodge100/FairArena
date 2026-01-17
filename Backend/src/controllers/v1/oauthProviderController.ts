/**
 * OAuth 2.0 / OpenID Connect Provider Controller
 *
 * Implements authorization server endpoints per RFC 6749, RFC 7636, and OpenID Connect Core.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { inngest } from '../../inngest/v1/client.js';
import {
    generateAccessToken,
    generateAuthorizationCode,
    generateIdToken,
    generateRefreshToken,
    generateSecureToken,
    getActiveSigningKeys,
    getDiscoveryDocument,
    getOrUpdateConsent,
    getUserClaims,
    hashRefreshToken,
    logOAuthEvent,
    parseScopes,
    validateScopes,
    verifyPkce,
} from '../../services/oauthProvider.service.js';
import logger from '../../utils/logger.js';

// ============================================
// DISCOVERY ENDPOINTS
// ============================================

/**
 * OpenID Connect Discovery Document
 * GET /.well-known/openid-configuration
 */
export async function discoveryEndpoint(_req: Request, res: Response): Promise<void> {
    res.json(getDiscoveryDocument());
}

/**
 * JSON Web Key Set (JWKS)
 * GET /.well-known/jwks.json
 */
export async function jwksEndpoint(_req: Request, res: Response): Promise<void> {
    try {
        const keys = await getActiveSigningKeys();

        // If no DB keys, include bootstrap key if available
        if (keys.length === 0 && ENV.OAUTH_BOOTSTRAP_RSA_PUBLIC_KEY) {
            const crypto = await import('crypto');
            const keyObject = crypto.createPublicKey(ENV.OAUTH_BOOTSTRAP_RSA_PUBLIC_KEY.replace(/\\n/g, '\n'));
            const jwk = keyObject.export({ format: 'jwk' }) as { n: string; e: string };

            keys.push({
                kty: 'RSA',
                use: 'sig',
                kid: 'bootstrap-key-1',
                alg: 'RS256',
                n: jwk.n,
                e: jwk.e,
            });
        }

        res.json({ keys });
    } catch (error) {
        logger.error('Failed to generate JWKS', { error });
        res.status(500).json({ error: 'server_error', error_description: 'Failed to retrieve keys' });
    }
}

// ============================================
// AUTHORIZATION ENDPOINT
// ============================================

const authorizeSchema = z.object({
    response_type: z.literal('code'),
    client_id: z.string().min(1),
    redirect_uri: z.string().url(),
    scope: z.string().min(1),
    state: z.string().optional(),
    nonce: z.string().optional(),
    code_challenge: z.string().optional(),
    code_challenge_method: z.enum(['S256', 'plain']).optional(),
});

/**
 * Authorization Endpoint
 * GET/POST /oauth/authorize
 *
 * Creates an immutable AuthorizationRequest and redirects to consent UI.
 */
export async function authorizeEndpoint(req: Request, res: Response): Promise<void> {
    const params = req.method === 'GET' ? req.query : req.body;

    // Validate parameters
    const validation = authorizeSchema.safeParse(params);
    if (!validation.success) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: validation.error.issues.map((e) => e.message).join(', '),
        });
        return;
    }

    const { response_type, client_id, redirect_uri, scope, state, nonce, code_challenge, code_challenge_method } =
        validation.data;

    // Look up application
    const application = await prisma.oAuthApplication.findUnique({
        where: { clientId: client_id, isActive: true },
    });

    if (!application) {
        res.status(400).json({
            error: 'invalid_client',
            error_description: 'Unknown client_id',
        });
        return;
    }

    // Validate redirect_uri (exact match required)
    if (!application.redirectUris.includes(redirect_uri)) {
        logger.warn('Invalid redirect_uri', { clientId: client_id, redirectUri: redirect_uri });
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Invalid redirect_uri',
        });
        return;
    }

    // Check if response_type is allowed
    if (!application.responseTypes.includes(response_type)) {
        sendAuthError(res, redirect_uri, state, 'unsupported_response_type', 'Response type not allowed');
        return;
    }

    // Validate PKCE for public clients (required)
    if (application.isPublic && !code_challenge) {
        sendAuthError(res, redirect_uri, state, 'invalid_request', 'PKCE required for public clients');
        return;
    }

    // If PKCE is provided, method must be specified
    if (code_challenge && !code_challenge_method) {
        sendAuthError(res, redirect_uri, state, 'invalid_request', 'code_challenge_method required');
        return;
    }

    // Only allow S256 (plain is weak)
    if (code_challenge_method === 'plain') {
        sendAuthError(res, redirect_uri, state, 'invalid_request', 'Only S256 challenge method is supported');
        return;
    }

    // Validate requested scopes
    const requestedScopes = parseScopes(scope);

    // Check if openid scope is present for OIDC
    const isOidcRequest = requestedScopes.includes('openid');

    // OIDC requires nonce for implicit/hybrid flows (not for code flow, but recommended)
    // We don't require it but will include in ID token if provided

    const scopeValidation = await validateScopes(requestedScopes, {
        allowedScopes: application.allowedScopes,
        isVerified: application.isVerified,
    });

    if (!scopeValidation.valid) {
        sendAuthError(res, redirect_uri, state, 'invalid_scope', scopeValidation.errors.join('; '));
        return;
    }

    // Get authenticated user from session
    const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

    // Create immutable authorization request
    const requestId = generateSecureToken(24);
    const expiresAt = new Date(Date.now() + ENV.OAUTH_AUTH_REQUEST_EXPIRY * 1000);

    const authRequest = await prisma.oAuthAuthorizationRequest.create({
        data: {
            requestId,
            applicationId: application.id,
            userId: userId || null,
            responseType: response_type,
            redirectUri: redirect_uri,
            scope: scopeValidation.scopes.join(' '),
            state,
            nonce,
            codeChallenge: code_challenge,
            codeChallengeMethod: code_challenge_method,
            status: 'pending',
            expiresAt,
        },
    });

    await logOAuthEvent('authorization_request_created', {
        applicationId: application.id,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { requestId, scopes: scopeValidation.scopes },
    });

    // If user not logged in, redirect to login with return to consent
    if (!userId) {
        const loginUrl = new URL(`${ENV.FRONTEND_URL}/signin`);
        loginUrl.searchParams.set('oauth_request', requestId);
        res.redirect(loginUrl.toString());
        return;
    }

    // Check for existing consent
    const existingConsent = await prisma.oAuthConsent.findUnique({
        where: {
            userId_applicationId: { userId, applicationId: application.id },
        },
    });

    // Determine if we need to show consent screen
    const existingScopes = new Set(existingConsent?.grantedScopes || []);
    const newScopesNeeded = scopeValidation.scopes.filter((s) => !existingScopes.has(s));
    const needsConsent = application.isTrusted === false && (newScopesNeeded.length > 0 || !existingConsent);

    if (!needsConsent) {
        // Auto-approve: user has already consented to all requested scopes
        await processConsent(req, res, authRequest.id, scopeValidation.scopes, true);
        return;
    }

    // Redirect to consent UI
    const consentUrl = new URL(`${ENV.FRONTEND_URL}/oauth/consent`);
    consentUrl.searchParams.set('request_id', requestId);
    res.redirect(consentUrl.toString());
}

/**
 * Helper to send authorization error via redirect
 */
function sendAuthError(
    res: Response,
    redirectUri: string,
    state: string | undefined,
    error: string,
    description: string,
): void {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) {
        url.searchParams.set('state', state);
    }
    res.redirect(url.toString());
}

// ============================================
// CONSENT ENDPOINT
// ============================================

const consentSchema = z.object({
    request_id: z.string().min(1),
    action: z.enum(['approve', 'deny']),
    scopes: z.array(z.string()).optional(), // User can deselect optional scopes
});

/**
 * Consent Submission Endpoint
 * POST /oauth/authorize/consent
 */
export async function consentEndpoint(req: Request, res: Response): Promise<void> {
    const validation = consentSchema.safeParse(req.body);
    if (!validation.success) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: validation.error.issues.map((e) => e.message).join(', '),
        });
        return;
    }

    const { request_id, action, scopes } = validation.data;
    const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

    if (!userId) {
        res.status(401).json({
            error: 'login_required',
            error_description: 'User authentication required',
        });
        return;
    }

    // Find the authorization request
    const authRequest = await prisma.oAuthAuthorizationRequest.findUnique({
        where: { requestId: request_id },
        include: { application: true },
    });

    if (!authRequest) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request not found',
        });
        return;
    }

    // Validate request is still valid
    if (authRequest.status !== 'pending') {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request already processed',
        });
        return;
    }

    if (new Date() > authRequest.expiresAt) {
        await prisma.oAuthAuthorizationRequest.update({
            where: { id: authRequest.id },
            data: { status: 'expired' },
        });
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request expired',
        });
        return;
    }

    // Bind user to request if not already bound
    if (authRequest.userId && authRequest.userId !== userId) {
        res.status(400).json({
            error: 'access_denied',
            error_description: 'Authorization request belongs to different user',
        });
        return;
    }

    // Handle denial
    if (action === 'deny') {
        await prisma.oAuthAuthorizationRequest.update({
            where: { id: authRequest.id },
            data: { status: 'denied', userId, completedAt: new Date() },
        });

        await logOAuthEvent('authorization_request_denied', {
            applicationId: authRequest.applicationId,
            userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        sendAuthError(
            res,
            authRequest.redirectUri,
            authRequest.state || undefined,
            'access_denied',
            'User denied the authorization request',
        );
        return;
    }

    // Process approval
    const requestedScopes = parseScopes(authRequest.scope);
    const approvedScopes = scopes || requestedScopes; // If no specific scopes, approve all requested

    // Validate approved scopes are subset of requested
    const validApprovedScopes = approvedScopes.filter((s) => requestedScopes.includes(s));

    // openid must always be present if originally requested
    if (requestedScopes.includes('openid') && !validApprovedScopes.includes('openid')) {
        validApprovedScopes.push('openid');
    }

    await processConsent(req, res, authRequest.id, validApprovedScopes, false, true);
}

/**
 * Process approved consent and generate authorization code
 */
async function processConsent(
    req: Request,
    res: Response,
    authRequestId: string,
    scopes: string[],
    isAutoApproved: boolean,
    returnJson = false,
): Promise<void> {
    const userId = (req as unknown as { user?: { userId: string } }).user?.userId;

    if (!userId) {
        res.status(401).json({
            error: 'login_required',
            error_description: 'User authentication required',
        });
        return;
    }

    const authRequest = await prisma.oAuthAuthorizationRequest.findUnique({
        where: { id: authRequestId },
        include: { application: true },
    });

    if (!authRequest) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request not found',
        });
        return;
    }

    // Update consent record (incremental)
    await getOrUpdateConsent(userId, authRequest.applicationId, scopes);

    // Generate authorization code
    const code = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + ENV.OAUTH_AUTH_CODE_EXPIRY * 1000);

    await prisma.$transaction([
        prisma.oAuthAuthorizationRequest.update({
            where: { id: authRequest.id },
            data: {
                status: 'consented',
                userId,
                consentedScopes: scopes,
                completedAt: new Date(),
            },
        }),
        prisma.oAuthAuthorizationCode.create({
            data: {
                code,
                authorizationRequestId: authRequest.id,
                applicationId: authRequest.applicationId,
                userId,
                redirectUri: authRequest.redirectUri,
                scope: scopes.join(' '),
                codeChallenge: authRequest.codeChallenge,
                codeChallengeMethod: authRequest.codeChallengeMethod,
                nonce: authRequest.nonce,
                expiresAt,
            },
        }),
    ]);

    await logOAuthEvent('authorization_request_consented', {
        applicationId: authRequest.applicationId,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { scopes, isAutoApproved },
    });

    // Check if this is a first-time authorization for notifications
    const existingConsent = await prisma.oAuthConsent.findFirst({
        where: {
            userId,
            applicationId: authRequest.applicationId,
            revokedAt: null,
        },
        orderBy: { createdAt: 'asc' },
    });

    // Emit notification event for Inngest to process
    const scopeLabels = scopes.map(scope => {
        switch (scope) {
            case 'openid': return 'Verify your identity';
            case 'profile': return 'View your profile information';
            case 'email': return 'View your email address';
            case 'offline_access': return 'Access your data when you\'re not using the app';
            default: return scope;
        }
    });

    await inngest.send({
        name: 'oauth/app-authorized',
        data: {
            userId,
            applicationId: authRequest.applicationId,
            permissions: scopeLabels,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('user-agent') || 'unknown',
            // Consider it first authorization if consent was just created (within last 5 seconds)
            isFirstAuthorization: existingConsent
                ? (Date.now() - new Date(existingConsent.createdAt).getTime()) < 5000
                : false,
        },
    });

    // Redirect with code
    const redirectUrl = new URL(authRequest.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (authRequest.state) {
        redirectUrl.searchParams.set('state', authRequest.state);
    }

    if (returnJson) {
        res.json({ success: true, redirectUrl: redirectUrl.toString() });
    } else {
        res.redirect(redirectUrl.toString());
    }
}

export async function getAuthorizationRequest(req: Request, res: Response): Promise<void> {
    const { requestId } = req.params;

    const authRequest = await prisma.oAuthAuthorizationRequest.findUnique({
        where: { requestId: requestId as string },
        include: {
            application: {
                select: {
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

    if (!authRequest) {
        res.status(404).json({
            error: 'not_found',
            error_description: 'Authorization request not found',
        });
        return;
    }

    if (authRequest.status !== 'pending') {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request already processed',
        });
        return;
    }

    if (new Date() > authRequest.expiresAt) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization request expired',
        });
        return;
    }

    // Get scope details
    const requestedScopes = parseScopes(authRequest.scope);
    const scopeDetails = await prisma.oAuthScope.findMany({
        where: { name: { in: requestedScopes } },
        select: {
            name: true,
            displayName: true,
            description: true,
            isDangerous: true,
        },
    });

    // Map scope details, including OIDC scopes not in DB
    const scopeDescriptions: Record<string, { displayName: string; description: string; isDangerous: boolean }> = {
        openid: { displayName: 'OpenID', description: 'Verify your identity', isDangerous: false },
        profile: { displayName: 'Profile', description: 'Access your profile information (name, picture)', isDangerous: false },
        email: { displayName: 'Email', description: 'Access your email address', isDangerous: false },
        offline_access: { displayName: 'Offline Access', description: 'Access your data when you are not present', isDangerous: false },
    };

    const scopes = requestedScopes.map((name) => {
        const dbScope = scopeDetails.find((s) => s.name === name);
        const fallback = scopeDescriptions[name];
        return {
            name,
            displayName: dbScope?.displayName || fallback?.displayName || name,
            description: dbScope?.description || fallback?.description || '',
            isDangerous: dbScope?.isDangerous || fallback?.isDangerous || false,
        };
    });

    res.json({
        application: authRequest.application,
        scopes,
        expiresAt: authRequest.expiresAt,
    });
}

// ============================================
// TOKEN ENDPOINT
// ============================================

const tokenSchema = z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token', 'client_credentials']),
    code: z.string().optional(),
    redirect_uri: z.string().optional(),
    code_verifier: z.string().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
    audience: z.string().optional(),
});

/**
 * Token Endpoint
 * POST /oauth/token
 */
export async function tokenEndpoint(req: Request, res: Response): Promise<void> {
    const client = req.oauthClient;

    if (!client) {
        res.status(401).json({
            error: 'invalid_client',
            error_description: 'Client authentication required',
        });
        return;
    }

    const validation = tokenSchema.safeParse(req.body);
    if (!validation.success) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: validation.error.issues.map((e) => e.message).join(', '),
        });
        return;
    }

    const { grant_type } = validation.data;

    // Check if grant type is allowed
    if (!client.grantTypes.includes(grant_type)) {
        res.status(400).json({
            error: 'unauthorized_client',
            error_description: `Grant type '${grant_type}' not allowed for this client`,
        });
        return;
    }

    switch (grant_type) {
        case 'authorization_code':
            await handleAuthorizationCodeGrant(req, res, validation.data);
            break;
        case 'refresh_token':
            await handleRefreshTokenGrant(req, res, validation.data);
            break;
        case 'client_credentials':
            await handleClientCredentialsGrant(req, res, validation.data);
            break;
        default:
            res.status(400).json({
                error: 'unsupported_grant_type',
                error_description: `Grant type '${grant_type}' is not supported`,
            });
    }
}

/**
 * Handle authorization_code grant
 */
async function handleAuthorizationCodeGrant(
    req: Request,
    res: Response,
    params: z.infer<typeof tokenSchema>,
): Promise<void> {
    const client = req.oauthClient!;
    const { code, redirect_uri, code_verifier } = params;

    if (!code) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Authorization code required',
        });
        return;
    }

    if (!redirect_uri) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uri required',
        });
        return;
    }

    // Find the authorization code
    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { code },
        include: { authorizationRequest: true },
    });

    if (!authCode) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code not found',
        });
        return;
    }

    // Validate code belongs to this client
    if (authCode.applicationId !== client.id) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code was not issued to this client',
        });
        return;
    }

    // Check if already used
    if (authCode.usedAt) {
        logger.warn('Authorization code reuse detected', {
            codeId: authCode.id,
            clientId: client.clientId,
        });
        // Security: Revoke all tokens from this authorization
        // (implementation simplified for now)
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code has already been used',
        });
        return;
    }

    // Check expiration
    if (new Date() > authCode.expiresAt) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code has expired',
        });
        return;
    }

    // Validate redirect_uri matches
    if (authCode.redirectUri !== redirect_uri) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'redirect_uri does not match',
        });
        return;
    }

    // Validate PKCE if code_challenge was used
    if (authCode.codeChallenge) {
        if (!code_verifier) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'code_verifier required',
            });
            return;
        }

        if (!verifyPkce(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod || 'S256')) {
            res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid code_verifier',
            });
            return;
        }
    }

    // Mark code as used
    await prisma.oAuthAuthorizationCode.update({
        where: { id: authCode.id },
        data: { usedAt: new Date() },
    });

    // Update authorization request status
    await prisma.oAuthAuthorizationRequest.update({
        where: { id: authCode.authorizationRequestId },
        data: { status: 'used' },
    });

    // Generate tokens
    const scopes = parseScopes(authCode.scope);
    const isOidc = scopes.includes('openid');
    const includeRefreshToken = scopes.includes('offline_access');

    // Generate access token
    const { token: accessToken, jti, expiresAt: accessExpiresAt } = await generateAccessToken({
        clientId: client.clientId,
        userId: authCode.userId,
        scope: authCode.scope,
    });

    // Store access token metadata
    await prisma.oAuthAccessToken.create({
        data: {
            jti,
            applicationId: client.id,
            userId: authCode.userId,
            scope: authCode.scope,
            grantType: 'authorization_code',
            expiresAt: accessExpiresAt,
        },
    });

    // Prepare response
    const tokenResponse: {
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
        refresh_token?: string;
        id_token?: string;
    } = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ENV.OAUTH_ACCESS_TOKEN_EXPIRY,
        scope: authCode.scope,
    };

    // Generate refresh token if offline_access scope
    if (includeRefreshToken) {
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const familyId = generateSecureToken(16);
        const refreshExpiresAt = new Date(Date.now() + ENV.OAUTH_REFRESH_TOKEN_EXPIRY * 1000);

        await prisma.oAuthRefreshToken.create({
            data: {
                tokenHash: refreshTokenHash,
                applicationId: client.id,
                userId: authCode.userId,
                scope: authCode.scope,
                familyId,
                generation: 0,
                expiresAt: refreshExpiresAt,
            },
        });

        tokenResponse.refresh_token = refreshToken;
    }

    // Generate ID token if OIDC
    if (isOidc) {
        const claims = await getUserClaims(authCode.userId, scopes);
        const idToken = await generateIdToken({
            clientId: client.clientId,
            userId: authCode.userId,
            nonce: authCode.nonce || undefined,
            claims,
        });
        tokenResponse.id_token = idToken;
    }

    await logOAuthEvent('access_token_issued', {
        applicationId: client.id,
        userId: authCode.userId,
        ipAddress: req.ip,
        metadata: { grantType: 'authorization_code', scopes },
    });

    res.json(tokenResponse);
}

/**
 * Handle refresh_token grant
 */
async function handleRefreshTokenGrant(
    req: Request,
    res: Response,
    params: z.infer<typeof tokenSchema>,
): Promise<void> {
    const client = req.oauthClient!;
    const { refresh_token, scope: requestedScope } = params;

    if (!refresh_token) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'refresh_token required',
        });
        return;
    }

    const tokenHash = hashRefreshToken(refresh_token);

    // Find refresh token
    const storedToken = await prisma.oAuthRefreshToken.findUnique({
        where: { tokenHash },
    });

    if (!storedToken) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid refresh token',
        });
        return;
    }

    // Validate token belongs to this client
    if (storedToken.applicationId !== client.id) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Refresh token was not issued to this client',
        });
        return;
    }

    // Check if revoked
    if (storedToken.revokedAt) {
        logger.warn('Revoked refresh token used', {
            tokenId: storedToken.id,
            clientId: client.clientId,
        });
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Refresh token has been revoked',
        });
        return;
    }

    // Check if already rotated (token reuse attack detection)
    if (storedToken.rotatedAt) {
        logger.warn('Refresh token reuse detected - revoking entire family', {
            tokenId: storedToken.id,
            familyId: storedToken.familyId,
            clientId: client.clientId,
        });

        // Revoke entire token family
        await prisma.oAuthRefreshToken.updateMany({
            where: { familyId: storedToken.familyId },
            data: { revokedAt: new Date() },
        });

        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Refresh token has been revoked due to security concerns',
        });
        return;
    }

    // Check expiration
    if (new Date() > storedToken.expiresAt) {
        res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Refresh token has expired',
        });
        return;
    }

    // Validate scope (must be subset of original)
    const originalScopes = parseScopes(storedToken.scope);
    let newScopes = originalScopes;

    if (requestedScope) {
        const requestedScopes = parseScopes(requestedScope);
        const invalidScopes = requestedScopes.filter((s) => !originalScopes.includes(s));

        if (invalidScopes.length > 0) {
            res.status(400).json({
                error: 'invalid_scope',
                error_description: `Requested scopes exceed original grant: ${invalidScopes.join(', ')}`,
            });
            return;
        }

        newScopes = requestedScopes;
    }

    // Mark current token as rotated
    await prisma.oAuthRefreshToken.update({
        where: { id: storedToken.id },
        data: { rotatedAt: new Date() },
    });

    // Generate new refresh token
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + ENV.OAUTH_REFRESH_TOKEN_EXPIRY * 1000);

    await prisma.oAuthRefreshToken.create({
        data: {
            tokenHash: newTokenHash,
            applicationId: client.id,
            userId: storedToken.userId,
            scope: newScopes.join(' '),
            familyId: storedToken.familyId,
            generation: storedToken.generation + 1,
            expiresAt: refreshExpiresAt,
        },
    });

    // Generate new access token
    const { token: accessToken, jti, expiresAt: accessExpiresAt } = await generateAccessToken({
        clientId: client.clientId,
        userId: storedToken.userId,
        scope: newScopes.join(' '),
    });

    await prisma.oAuthAccessToken.create({
        data: {
            jti,
            applicationId: client.id,
            userId: storedToken.userId,
            scope: newScopes.join(' '),
            grantType: 'refresh_token',
            expiresAt: accessExpiresAt,
        },
    });

    await logOAuthEvent('refresh_token_rotated', {
        applicationId: client.id,
        userId: storedToken.userId,
        ipAddress: req.ip,
        metadata: { newGeneration: storedToken.generation + 1 },
    });

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ENV.OAUTH_ACCESS_TOKEN_EXPIRY,
        refresh_token: newRefreshToken,
        scope: newScopes.join(' '),
    });
}

/**
 * Handle client_credentials grant (machine-to-machine)
 */
async function handleClientCredentialsGrant(
    req: Request,
    res: Response,
    params: z.infer<typeof tokenSchema>,
): Promise<void> {
    const client = req.oauthClient!;

    // client_credentials ONLY for confidential clients
    if (!client.isConfidential) {
        res.status(400).json({
            error: 'unauthorized_client',
            error_description: 'client_credentials grant requires confidential client',
        });
        return;
    }

    // Parse requested scope
    const requestedScopes = params.scope ? parseScopes(params.scope) : [];

    // OIDC scopes are NOT allowed for client_credentials
    const oidcScopes = ['openid', 'profile', 'email'];
    const invalidOidcScopes = requestedScopes.filter((s) => oidcScopes.includes(s));

    if (invalidOidcScopes.length > 0) {
        res.status(400).json({
            error: 'invalid_scope',
            error_description: 'OIDC scopes not allowed for client_credentials grant',
        });
        return;
    }

    // Validate scopes
    const scopeValidation = await validateScopes(requestedScopes, {
        allowedScopes: client.allowedScopes,
        isVerified: client.isVerified,
    });

    if (!scopeValidation.valid) {
        res.status(400).json({
            error: 'invalid_scope',
            error_description: scopeValidation.errors.join('; '),
        });
        return;
    }

    // Validate audience if provided
    const audience = params.audience;
    if (audience && client.allowedAudiences.length > 0) {
        if (!client.allowedAudiences.includes(audience)) {
            res.status(400).json({
                error: 'invalid_target',
                error_description: 'Requested audience not allowed for this client',
            });
            return;
        }
    }

    // Generate access token (NO user, NO refresh token, NO ID token)
    const { token: accessToken, jti, expiresAt } = await generateAccessToken({
        clientId: client.clientId,
        userId: null, // M2M token has no user
        scope: scopeValidation.scopes.join(' '),
        audience,
    });

    await prisma.oAuthAccessToken.create({
        data: {
            jti,
            applicationId: client.id,
            userId: null,
            audience,
            scope: scopeValidation.scopes.join(' '),
            grantType: 'client_credentials',
            expiresAt,
        },
    });

    await logOAuthEvent('access_token_issued', {
        applicationId: client.id,
        ipAddress: req.ip,
        metadata: { grantType: 'client_credentials', scopes: scopeValidation.scopes, audience },
    });

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ENV.OAUTH_ACCESS_TOKEN_EXPIRY,
        scope: scopeValidation.scopes.join(' '),
    });
}

// ============================================
// USERINFO ENDPOINT
// ============================================

/**
 * UserInfo Endpoint
 * GET/POST /oauth/userinfo
 */
export async function userinfoEndpoint(req: Request, res: Response): Promise<void> {
    const token = req.oauthToken;

    if (!token) {
        res.status(401).json({
            error: 'invalid_token',
            error_description: 'Access token required',
        });
        return;
    }

    // client_credentials tokens have no user
    if (!token.sub) {
        res.status(403).json({
            error: 'insufficient_scope',
            error_description: 'Token does not represent a user',
        });
        return;
    }

    // Must have openid scope
    const scopes = parseScopes(token.scope);
    if (!scopes.includes('openid')) {
        res.status(403).json({
            error: 'insufficient_scope',
            error_description: 'openid scope required',
            scope: 'openid',
        });
        return;
    }

    try {
        const claims = await getUserClaims(token.sub, scopes);
        res.json(claims);
    } catch (error) {
        logger.error('Failed to get user claims', { error, userId: token.sub });
        res.status(500).json({
            error: 'server_error',
            error_description: 'Failed to retrieve user information',
        });
    }
}

// ============================================
// TOKEN REVOCATION ENDPOINT
// ============================================

const revokeSchema = z.object({
    token: z.string().min(1),
    token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
});

/**
 * Token Revocation Endpoint
 * POST /oauth/revoke
 */
export async function revokeEndpoint(req: Request, res: Response): Promise<void> {
    const client = req.oauthClient;

    if (!client) {
        res.status(401).json({
            error: 'invalid_client',
            error_description: 'Client authentication required',
        });
        return;
    }

    const validation = revokeSchema.safeParse(req.body);
    if (!validation.success) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: validation.error.issues.map((e) => e.message).join(', '),
        });
        return;
    }

    const { token, token_type_hint } = validation.data;

    // Try to find and revoke the token
    // Per RFC 7009, we should return 200 OK even if token is invalid

    // Try as refresh token first (if hinted or by default)
    if (!token_type_hint || token_type_hint === 'refresh_token') {
        const tokenHash = hashRefreshToken(token);
        const refreshToken = await prisma.oAuthRefreshToken.findUnique({
            where: { tokenHash },
        });

        if (refreshToken && refreshToken.applicationId === client.id) {
            await prisma.oAuthRefreshToken.update({
                where: { id: refreshToken.id },
                data: { revokedAt: new Date() },
            });

            await logOAuthEvent('token_revoked', {
                applicationId: client.id,
                userId: refreshToken.userId,
                ipAddress: req.ip,
                metadata: { tokenType: 'refresh_token' },
            });

            res.status(200).send();
            return;
        }
    }

    // Try as access token (requires decoding JWT to get jti)
    if (!token_type_hint || token_type_hint === 'access_token') {
        try {
            // We need to decode without verification to get jti
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.decode(token) as { jti?: string } | null;

            if (decoded?.jti) {
                const accessToken = await prisma.oAuthAccessToken.findUnique({
                    where: { jti: decoded.jti },
                });

                if (accessToken && accessToken.applicationId === client.id) {
                    await prisma.oAuthAccessToken.update({
                        where: { id: accessToken.id },
                        data: { revokedAt: new Date() },
                    });

                    await logOAuthEvent('token_revoked', {
                        applicationId: client.id,
                        userId: accessToken.userId || undefined,
                        ipAddress: req.ip,
                        metadata: { tokenType: 'access_token' },
                    });
                }
            }
        } catch {
            // Token might not be a valid JWT, ignore
        }
    }

    // Always return 200 OK per RFC 7009
    res.status(200).send();
}

// ============================================
// TOKEN INTROSPECTION ENDPOINT
// ============================================

const introspectSchema = z.object({
    token: z.string().min(1),
    token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
});

/**
 * Token Introspection Endpoint
 * POST /oauth/introspect
 *
 * Security: Only confidential clients can introspect.
 * Security: Clients can only introspect tokens issued to themselves.
 */
export async function introspectEndpoint(req: Request, res: Response): Promise<void> {
    const client = req.oauthClient;

    if (!client) {
        res.status(401).json({
            error: 'invalid_client',
            error_description: 'Client authentication required',
        });
        return;
    }

    // Only confidential clients can introspect
    if (!client.isConfidential) {
        res.status(401).json({
            error: 'invalid_client',
            error_description: 'Only confidential clients can introspect tokens',
        });
        return;
    }

    const validation = introspectSchema.safeParse(req.body);
    if (!validation.success) {
        res.status(400).json({
            error: 'invalid_request',
            error_description: validation.error.issues.map((e) => e.message).join(', '),
        });
        return;
    }

    const { token, token_type_hint } = validation.data;

    // Try to introspect as access token
    if (!token_type_hint || token_type_hint === 'access_token') {
        try {
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.decode(token) as {
                jti?: string;
                client_id?: string;
                sub?: string | null;
                scope?: string;
                exp?: number;
                iat?: number;
            } | null;

            if (decoded?.jti) {
                // Verify token belongs to this client
                if (decoded.client_id !== client.clientId) {
                    // Return inactive for tokens not belonging to this client
                    res.json({ active: false });
                    return;
                }

                const accessToken = await prisma.oAuthAccessToken.findUnique({
                    where: { jti: decoded.jti },
                });

                if (accessToken && !accessToken.revokedAt && new Date() < accessToken.expiresAt) {
                    await logOAuthEvent('token_introspected', {
                        applicationId: client.id,
                        ipAddress: req.ip,
                        metadata: { tokenType: 'access_token' },
                    });

                    // Return limited info per security requirements (no PII)
                    res.json({
                        active: true,
                        scope: accessToken.scope,
                        client_id: client.clientId,
                        token_type: 'Bearer',
                        exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
                        iat: Math.floor(accessToken.createdAt.getTime() / 1000),
                    });
                    return;
                }
            }
        } catch {
            // Not a valid JWT
        }
    }

    // Try as refresh token
    if (!token_type_hint || token_type_hint === 'refresh_token') {
        const tokenHash = hashRefreshToken(token);
        const refreshToken = await prisma.oAuthRefreshToken.findUnique({
            where: { tokenHash },
        });

        // Only show info if token belongs to this client
        if (refreshToken && refreshToken.applicationId === client.id) {
            if (!refreshToken.revokedAt && !refreshToken.rotatedAt && new Date() < refreshToken.expiresAt) {
                await logOAuthEvent('token_introspected', {
                    applicationId: client.id,
                    ipAddress: req.ip,
                    metadata: { tokenType: 'refresh_token' },
                });

                res.json({
                    active: true,
                    scope: refreshToken.scope,
                    client_id: client.clientId,
                    token_type: 'refresh_token',
                    exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
                    iat: Math.floor(refreshToken.createdAt.getTime() / 1000),
                });
                return;
            }
        }
    }

    // Token not found or invalid
    res.json({ active: false });
}
