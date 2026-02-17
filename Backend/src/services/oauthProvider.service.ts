import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';

// ============================================
// TYPES
// ============================================

export interface JWKSKey {
  kty: 'RSA';
  use: 'sig';
  kid: string;
  alg: string;
  n: string; // modulus
  e: string; // exponent
}

export interface AccessTokenPayload {
  iss: string;
  sub: string | null; // null for client_credentials
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  scope: string;
  client_id: string;
}

export interface IdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  // Standard claims
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface UserInfoClaims {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

// ============================================
// JWKS KEY MANAGEMENT
// ============================================

/**
 * Get all active signing keys for JWKS endpoint
 */
export async function getActiveSigningKeys(): Promise<JWKSKey[]> {
  const keys = await prisma.oAuthSigningKey.findMany({
    where: { isActive: true },
  });

  return keys.map((key) => convertPemToJwk(key.publicKeyPem, key.kid, key.algorithm));
}

/**
 * Get the primary signing key for token generation
 */
export async function getPrimarySigningKey(): Promise<{
  kid: string;
  privateKey: string;
  algorithm: string;
} | null> {
  const key = await prisma.oAuthSigningKey.findFirst({
    where: { isPrimary: true, isActive: true },
  });

  if (key) {
    return {
      kid: key.kid,
      privateKey: key.privateKeyPem,
      algorithm: key.algorithm,
    };
  }

  // Fallback to bootstrap key if no DB key exists
  if (ENV.OAUTH_BOOTSTRAP_RSA_PRIVATE_KEY) {
    // Normalize the key - handle various formats from env vars
    let normalizedKey = ENV.OAUTH_BOOTSTRAP_RSA_PRIVATE_KEY;

    // Replace literal \n with actual newlines (handles both \\n and \n)
    normalizedKey = normalizedKey.replace(/\\n/g, '\n');

    // Ensure proper PEM format with headers/footers
    if (!normalizedKey.includes('-----BEGIN')) {
      logger.error('Invalid RSA private key format - missing PEM headers');
      // Continue to auto-generation
    } else {
      return {
        kid: 'bootstrap-key-1',
        privateKey: normalizedKey.trim(),
        algorithm: 'RS256',
      };
    }
  }

  // No signing key available
  logger.error('No OAuth signing key available - please configure OAUTH_BOOTSTRAP_RSA_PRIVATE_KEY');
  return null;
}

/**
 * Convert PEM public key to JWK format
 */
function convertPemToJwk(publicKeyPem: string, kid: string, algorithm: string): JWKSKey {
  const keyObject = crypto.createPublicKey(publicKeyPem);
  const jwk = keyObject.export({ format: 'jwk' }) as {
    n: string;
    e: string;
  };

  return {
    kty: 'RSA',
    use: 'sig',
    kid,
    alg: algorithm,
    n: jwk.n,
    e: jwk.e,
  };
}

/**
 * Generate a new RSA key pair for signing
 */
export async function generateSigningKeyPair(): Promise<{
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
}> {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          kid: `fa-key-${Date.now()}`,
          publicKeyPem: publicKey,
          privateKeyPem: privateKey,
        });
      },
    );
  });
}

// ============================================
// PKCE (Proof Key for Code Exchange)
// ============================================

/**
 * Verify PKCE code_verifier against stored code_challenge
 */
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string,
): boolean {
  if (codeChallengeMethod === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const computed = hash.toString('base64url');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge));
  } else if (codeChallengeMethod === 'plain') {
    return crypto.timingSafeEqual(Buffer.from(codeVerifier), Buffer.from(codeChallenge));
  }
  return false;
}

/**
 * Generate a secure code challenge from a verifier (for testing)
 */
export function generateCodeChallenge(codeVerifier: string, method: 'S256' | 'plain'): string {
  if (method === 'S256') {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }
  return codeVerifier;
}

// ============================================
// CLIENT AUTHENTICATION
// ============================================

/**
 * Generate a secure client ID
 */
export function generateClientId(): string {
  return `fa_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate a secure client secret
 */
export function generateClientSecret(): string {
  return `fas_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash a client secret for storage
 */
export async function hashClientSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, ENV.BCRYPT_ROUNDS);
}

/**
 * Verify a client secret against its hash
 */
export async function verifyClientSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/**
 * Parse Basic authentication header
 */
export function parseBasicAuth(
  authHeader: string,
): { clientId: string; clientSecret: string } | null {
  if (!authHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const [clientId, clientSecret] = decoded.split(':');

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId: decodeURIComponent(clientId),
      clientSecret: decodeURIComponent(clientSecret),
    };
  } catch {
    return null;
  }
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate authorization code
 */
export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ============================================
// DEVICE AUTHORIZATION FLOW (RFC 8628)
// ============================================

/**
 * Generate device code (long opaque string for client polling)
 */
export function generateDeviceCode(): string {
  return crypto.randomBytes(64).toString('base64url'); // ~86 chars
}

/**
 * Generate user code (short human-readable code for user entry)
 * Format: ABCD-1234 (8 chars with hyphen)
 */
export function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (I, O, 0, 1)
  let code = '';

  for (let i = 0; i < 8; i++) {
    if (i === 4) {
      code += '-'; // Add hyphen in middle
    }
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Generate unique user code with collision detection
 * Retries up to 5 times if collision detected
 */
export async function generateUniqueUserCode(): Promise<string> {
  const { redis } = await import('../config/redis.js');
  const maxRetries = 5;

  for (let i = 0; i < maxRetries; i++) {
    const userCode = generateUserCode();

    // Check if user code already exists
    const exists = await redis.exists(`user_code:${userCode}`);
    if (!exists) {
      return userCode;
    }

    logger.warn('User code collision detected, retrying...', { userCode, attempt: i + 1 });
  }

  throw new Error('Failed to generate unique user code after multiple attempts');
}

/**
 * Hash device code for storage (using SHA-256)
 */
export function hashDeviceCode(deviceCode: string): string {
  return crypto.createHash('sha256').update(deviceCode).digest('hex');
}

/**
 * Store device code in Redis with hashed device_code
 * Redis key: device_code:{hash}
 * Redis key: user_code:{USER_CODE}
 */
export async function storeDeviceCode(params: {
  deviceCode: string;
  userCode: string;
  applicationId: string;
  scope: string;
  verificationUri: string;
}): Promise<void> {
  const { redis } = await import('../config/redis.js');
  const { deviceCode, userCode, applicationId, scope, verificationUri } = params;

  const deviceCodeHash = hashDeviceCode(deviceCode);
  const expiresIn = ENV.OAUTH_DEVICE_CODE_EXPIRY;

  const data = {
    applicationId,
    scope,
    status: 'pending',
    verificationUri,
    interval: ENV.OAUTH_DEVICE_POLL_INTERVAL,
    createdAt: Date.now(),
  };

  // Store by hashed device_code (for polling)
  await redis.setex(`device_code:${deviceCodeHash}`, expiresIn, JSON.stringify(data));

  // Store mapping from user_code to device_code_hash (for user authorization)
  await redis.setex(`user_code:${userCode}`, expiresIn, deviceCodeHash);
}

/**
 * Get device code data by hashed device code
 */
export async function getDeviceCodeByHash(deviceCodeHash: string): Promise<{
  applicationId: string;
  scope: string;
  status: string;
  userId?: string;
  verificationUri: string;
  interval: number;
  createdAt: number;
  lastPolledAt?: number;
  authorizedAt?: number;
} | null> {
  const { redis } = await import('../config/redis.js');
  const data = await redis.get(`device_code:${deviceCodeHash}`);

  if (!data) {
    return null;
  }

  // Handle case where Redis returns object instead of string
  if (typeof data === 'object') {
    return data as any;
  }

  try {
    return JSON.parse(data as string);
  } catch (error) {
    logger.error('Failed to parse device code data from Redis', { deviceCodeHash, data, error });
    return null;
  }
}

/**
 * Get device code hash by user code
 */
export async function getDeviceCodeHashByUserCode(userCode: string): Promise<string | null> {
  const { redis } = await import('../config/redis.js');
  const hash = await redis.get(`user_code:${userCode}`);
  return hash as string | null;
}

/**
 * Update device code status (authorize/deny)
 */
export async function updateDeviceCodeStatus(
  deviceCodeHash: string,
  status: 'authorized' | 'denied',
  userId?: string,
): Promise<void> {
  const { redis } = await import('../config/redis.js');
  const key = `device_code:${deviceCodeHash}`;

  const data = await getDeviceCodeByHash(deviceCodeHash);
  if (!data) {
    throw new Error('Device code not found');
  }

  data.status = status;
  if (userId) {
    data.userId = userId;
  }
  data.authorizedAt = Date.now();

  // Update with remaining TTL
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
}

/**
 * Update last polled time (for slow_down detection)
 */
export async function updateDeviceCodePollTime(deviceCodeHash: string): Promise<void> {
  const { redis } = await import('../config/redis.js');
  const key = `device_code:${deviceCodeHash}`;

  const data = await getDeviceCodeByHash(deviceCodeHash);
  if (!data) {
    return;
  }

  data.lastPolledAt = Date.now();

  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    await redis.setex(key, ttl, JSON.stringify(data));
  }
}

/**
 * Generate access token (JWT)
 */
export async function generateAccessToken(params: {
  clientId: string;
  userId: string | null;
  scope: string;
  audience?: string;
}): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const signingKey = await getPrimarySigningKey();
  if (!signingKey) {
    throw new Error('No signing key available');
  }

  const jti = generateSecureToken(24);
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = ENV.OAUTH_ACCESS_TOKEN_EXPIRY;
  const expiresAt = new Date((now + expiresIn) * 1000);

  const payload: AccessTokenPayload = {
    iss: ENV.OAUTH_ISSUER,
    sub: params.userId,
    aud: params.audience || params.clientId,
    exp: now + expiresIn,
    iat: now,
    jti,
    scope: params.scope,
    client_id: params.clientId,
  };

  const token = jwt.sign(payload, signingKey.privateKey, {
    algorithm: signingKey.algorithm as jwt.Algorithm,
    header: {
      alg: signingKey.algorithm,
      kid: signingKey.kid,
      typ: 'at+jwt', // RFC 9068 access token type
    },
  });

  return { token, jti, expiresAt };
}

/**
 * Generate ID token (JWT)
 */
export async function generateIdToken(params: {
  clientId: string;
  userId: string;
  nonce?: string;
  claims: UserInfoClaims;
}): Promise<string> {
  const signingKey = await getPrimarySigningKey();
  if (!signingKey) {
    throw new Error('No signing key available');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = ENV.OAUTH_ID_TOKEN_EXPIRY;

  const payload: IdTokenPayload = {
    iss: ENV.OAUTH_ISSUER,
    sub: params.claims.sub,
    aud: params.clientId,
    exp: now + expiresIn,
    iat: now,
    nonce: params.nonce,
    name: params.claims.name,
    given_name: params.claims.given_name,
    family_name: params.claims.family_name,
    picture: params.claims.picture,
    email: params.claims.email,
    email_verified: params.claims.email_verified,
  };

  // Remove undefined values
  Object.keys(payload).forEach((key) => {
    if (payload[key as keyof IdTokenPayload] === undefined) {
      delete payload[key as keyof IdTokenPayload];
    }
  });

  return jwt.sign(payload, signingKey.privateKey, {
    algorithm: signingKey.algorithm as jwt.Algorithm,
    header: {
      alg: signingKey.algorithm,
      kid: signingKey.kid,
      typ: 'JWT',
    },
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Hash refresh token for storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify and decode an access token
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    // Get all active public keys
    const keys = await prisma.oAuthSigningKey.findMany({
      where: { isActive: true },
    });

    // Try each key until one works
    for (const key of keys) {
      try {
        const payload = jwt.verify(token, key.publicKeyPem, {
          algorithms: [key.algorithm as jwt.Algorithm],
          issuer: ENV.OAUTH_ISSUER,
        }) as AccessTokenPayload;

        // Check if token is revoked
        const tokenRecord = await prisma.oAuthAccessToken.findUnique({
          where: { jti: payload.jti },
        });

        if (tokenRecord?.revokedAt) {
          return null;
        }

        return payload;
      } catch {
        // Try next key
        continue;
      }
    }

    // Try bootstrap key if no DB keys worked
    if (ENV.OAUTH_BOOTSTRAP_RSA_PUBLIC_KEY) {
      const payload = jwt.verify(token, ENV.OAUTH_BOOTSTRAP_RSA_PUBLIC_KEY.replace(/\\n/g, '\n'), {
        algorithms: ['RS256'],
        issuer: ENV.OAUTH_ISSUER,
      }) as AccessTokenPayload;

      const tokenRecord = await prisma.oAuthAccessToken.findUnique({
        where: { jti: payload.jti },
      });

      if (tokenRecord?.revokedAt) {
        return null;
      }

      return payload;
    }

    return null;
  } catch (error) {
    logger.warn('Access token verification failed', { error });
    return null;
  }
}

// ============================================
// SCOPE VALIDATION
// ============================================

const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

/**
 * Parse space-separated scope string
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validate requested scopes against application's allowed scopes
 */
export async function validateScopes(
  requestedScopes: string[],
  application: { allowedScopes: string[]; isVerified: boolean },
): Promise<{ valid: boolean; scopes: string[]; errors: string[] }> {
  const errors: string[] = [];
  const validScopes: string[] = [];

  // Get scope definitions from DB
  const scopeDefinitions = await prisma.oAuthScope.findMany({
    where: { name: { in: requestedScopes } },
  });

  const scopeMap = new Map(scopeDefinitions.map((s) => [s.name, s]));

  for (const scope of requestedScopes) {
    // Check if scope exists
    const definition = scopeMap.get(scope);

    // Allow OIDC scopes even if not in DB
    if (!definition && OIDC_SCOPES.includes(scope)) {
      if (application.allowedScopes.includes(scope) || application.allowedScopes.includes('*')) {
        validScopes.push(scope);
      } else {
        errors.push(`Scope '${scope}' not allowed for this application`);
      }
      continue;
    }

    if (!definition) {
      errors.push(`Unknown scope: ${scope}`);
      continue;
    }

    // Check if app is allowed to request this scope
    if (!application.allowedScopes.includes(scope) && !application.allowedScopes.includes('*')) {
      errors.push(`Scope '${scope}' not allowed for this application`);
      continue;
    }

    // Check if scope requires verification
    if (definition.requiresVerification && !application.isVerified) {
      errors.push(`Scope '${scope}' requires verified application`);
      continue;
    }

    validScopes.push(scope);
  }

  return {
    valid: errors.length === 0,
    scopes: validScopes,
    errors,
  };
}

/**
 * Get user claims based on granted scopes
 */
export async function getUserClaims(userId: string, scopes: string[]): Promise<UserInfoClaims> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      profileImageUrl: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const claims: UserInfoClaims = {
    sub: user.userId,
  };

  if (scopes.includes('profile')) {
    if (user.firstName || user.lastName) {
      claims.name = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
    }
    claims.given_name = user.firstName || undefined;
    claims.family_name = user.lastName || undefined;
    claims.picture = user.profileImageUrl || undefined;
  }

  if (scopes.includes('email')) {
    claims.email = user.email;
    claims.email_verified = user.emailVerified;
  }

  return claims;
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

/**
 * Get or create consent record with incremental scope merging
 */
export async function getOrUpdateConsent(
  userId: string,
  applicationId: string,
  newScopes: string[],
): Promise<{ consent: { grantedScopes: string[] }; isNew: boolean; newScopesGranted: string[] }> {
  const existing = await prisma.oAuthConsent.findUnique({
    where: {
      userId_applicationId: { userId, applicationId },
    },
  });

  if (existing && !existing.revokedAt) {
    // Incremental authorization - merge scopes
    const existingScopes = new Set(existing.grantedScopes);
    const newScopesGranted = newScopes.filter((s) => !existingScopes.has(s));

    if (newScopesGranted.length === 0) {
      // No new scopes, return existing consent
      return {
        consent: existing,
        isNew: false,
        newScopesGranted: [],
      };
    }

    // Update with merged scopes
    const mergedScopes = [...new Set([...existing.grantedScopes, ...newScopes])];
    const history = (existing.scopeHistory as Array<{ scopes: string[]; grantedAt: string }>) || [];
    const newHistory = [
      ...history,
      { scopes: newScopesGranted, grantedAt: new Date().toISOString() },
    ];

    const updated = await prisma.oAuthConsent.update({
      where: { id: existing.id },
      data: {
        grantedScopes: mergedScopes,
        scopeHistory: newHistory as unknown as Parameters<
          typeof prisma.oAuthConsent.update
        >[0]['data']['scopeHistory'],
      },
    });

    return {
      consent: updated,
      isNew: false,
      newScopesGranted,
    };
  }

  // Create new consent
  const initialHistory = [{ scopes: newScopes, grantedAt: new Date().toISOString() }];
  const consent = await prisma.oAuthConsent.create({
    data: {
      userId,
      applicationId,
      grantedScopes: newScopes,
      scopeHistory: initialHistory as unknown as Parameters<
        typeof prisma.oAuthConsent.create
      >[0]['data']['scopeHistory'],
    },
  });

  return {
    consent,
    isNew: true,
    newScopesGranted: newScopes,
  };
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logOAuthEvent(
  eventType: string,
  params: {
    applicationId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await prisma.oAuthAuditLog.create({
      data: {
        eventType,
        applicationId: params.applicationId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata as Parameters<
          typeof prisma.oAuthAuditLog.create
        >[0]['data']['metadata'],
      },
    });
  } catch (error) {
    logger.error('Failed to log OAuth event', { eventType, error });
  }
}

// ============================================
// OPENID CONNECT DISCOVERY
// ============================================

export function getDiscoveryDocument(): Record<string, unknown> {
  const issuer = ENV.OAUTH_ISSUER;

  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    device_authorization_endpoint: `${issuer}/oauth/device/authorize`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,

    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: [
      'authorization_code',
      'refresh_token',
      'client_credentials',
      'urn:ietf:params:oauth:grant-type:device_code',
    ],
    subject_types_supported: ['public'],

    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],

    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'nonce',
      'name',
      'given_name',
      'family_name',
      'picture',
      'email',
      'email_verified',
    ],

    service_documentation: 'https://docs.fairarena.app/oauth',

    // Explicitly document unsupported features
    _note: 'RP-Initiated Logout not yet supported',
  };
}
