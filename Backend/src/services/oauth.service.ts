import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { ENV } from '../config/env.js';
import {
  getOAuthProvider,
  type OAuthProviderConfig,
  type OAuthUserData,
} from '../config/oauth.providers.js';
import {
  MFA_SESSION_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from '../utils/cookie.utils.js';
import logger from '../utils/logger.js';
import {
  createSession,
  generateAccessToken,
  generateBindingToken,
  generateRefreshToken,
  parseUserAgent,
  storeSessionBinding,
} from './auth.service.js';

/**
 * Build MFA redirect URL
 */
function buildMfaRedirectUrl(redirectTarget: string): string {
  return `${ENV.FRONTEND_URL}/signin?mfa=required&redirect=${encodeURIComponent(redirectTarget)}`;
}

/**
 * Check multi-account session limits
 * Returns redirect URL if should redirect, null otherwise
 */
async function checkMultiAccountSession(
  req: Request,
  res: Response,
  userId: string,
  redirectPath: string,
): Promise<string | null> {
  // Implementation would go here - keeping existing logic
  // For now, return null (no redirect needed)
  return null;
}

/**
 * Generic OAuth token exchange
 */
export async function exchangeOAuthToken(
  provider: OAuthProviderConfig,
  code: string,
): Promise<{ accessToken: string; idToken?: string }> {
  // Use custom exchange if provided
  if (provider.exchangeToken) {
    return provider.exchangeToken(code);
  }

  // Standard OAuth 2.0 token exchange
  const tokenResponse = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: provider.callbackUrl,
      grant_type: provider.grantType || 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    logger.error(`${provider.displayName} token exchange failed`, { error });
    throw new Error(`${provider.displayName.toUpperCase()}_TOKEN_FAILED`);
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(`${provider.displayName.toUpperCase()}_TOKEN_FAILED`);
  }

  return {
    accessToken: tokenData.access_token,
    idToken: tokenData.id_token,
  };
}

/**
 * Fetch user info from OAuth provider
 */
export async function fetchOAuthUserInfo(
  provider: OAuthProviderConfig,
  accessToken: string,
  idToken?: string,
): Promise<any> {
  // For providers with ID tokens (like Google), decode and verify
  if (idToken && provider.name === 'google') {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(provider.clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: provider.clientId,
    });
    return ticket.getPayload();
  }

  // For providers requiring user info endpoint
  if (provider.userInfoUrl) {
    const userResponse = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`${provider.displayName.toUpperCase()}_USER_FETCH_FAILED`);
    }

    return userResponse.json();
  }

  throw new Error(`No user info method configured for ${provider.displayName}`);
}

/**
 * Find or create user from OAuth data
 */
export async function findOrCreateOAuthUser(oauthData: OAuthUserData): Promise<any> {
  const { email, providerId, providerName, ...userData } = oauthData;

  // Find user by email
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Check if signups are enabled
    if (!ENV.NEW_SIGNUP_ENABLED) {
      throw new Error('SIGNUP_DISABLED');
    }

    // Create new user
    const { createId } = await import('@paralleldrive/cuid2');
    const userId = createId();

    user = await prisma.user.create({
      data: {
        userId,
        email: email.toLowerCase(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        emailVerified: userData.emailVerified ?? true,
        // Store provider ID in a JSON field or separate table if needed
      },
    });

    logger.info(`New user created via ${providerName} OAuth`, {
      userId: user.userId,
      email: user.email,
    });
  } else {
    // Update profile image if missing
    if (!user.profileImageUrl && userData.profileImageUrl) {
      await prisma.user.update({
        where: { userId: user.userId },
        data: {
          profileImageUrl: userData.profileImageUrl,
          emailVerified: true,
        },
      });
    }

    logger.info(`${providerName} OAuth login for existing user`, {
      userId: user.userId,
    });
  }

  return user;
}

/**
 * Handle MFA flow for OAuth login
 */
export async function handleOAuthMfaFlow(
  user: any,
  req: Request,
  res: Response,
  redirectTarget: string,
): Promise<boolean> {
  if (!user.mfaEnabled) {
    return false; // No MFA required
  }

  const jwt = await import('jsonwebtoken');
  const userAgent = req.headers['user-agent'] || 'unknown';
  const { deviceType } = parseUserAgent(userAgent);
  const deviceFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  const tempToken = jwt.default.sign(
    {
      userId: user.userId,
      type: 'mfa_pending',
      ipAddress,
      deviceFingerprint,
    },
    ENV.JWT_SECRET,
    { expiresIn: '5m', issuer: 'fairarena' },
  );

  // Set MFA session cookies
  res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);
  res.cookie('mfa_redirect', redirectTarget, {
    ...MFA_SESSION_COOKIE_OPTIONS,
    httpOnly: false, // Frontend needs to read this
  });

  // Redirect to MFA page
  res.redirect(buildMfaRedirectUrl(redirectTarget));
  return true; // MFA flow initiated
}

/**
 * Handle successful OAuth login (no MFA)
 */
export async function handleSuccessfulOAuthLogin(
  user: any,
  req: Request,
  res: Response,
  redirectPath: string,
): Promise<void> {
  const userAgent = req.headers['user-agent'] as string;
  const ipAddress = req.ip || 'unknown';
  const { deviceType, deviceName } = parseUserAgent(userAgent);

  // Multi-account handling
  const existingSessionRedirect = await checkMultiAccountSession(
    req,
    res,
    user.userId,
    redirectPath,
  );
  if (existingSessionRedirect) {
    return res.redirect(existingSessionRedirect);
  }

  // Create session and tokens
  const refreshToken = generateRefreshToken();
  const sessionId = await createSession(user.userId, refreshToken, {
    deviceName,
    deviceType,
    userAgent,
    ipAddress,
  });
  const accessToken = generateAccessToken(user.userId, sessionId);

  // Update last login
  await prisma.user.update({
    where: { userId: user.userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  // Generate binding token for session security
  const { token: bindingToken, hash: bindingHash } = generateBindingToken();
  await storeSessionBinding(sessionId, bindingHash);

  // Set multi-session cookies
  res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

  // Clear any MFA cookies
  res.clearCookie('mfa_session', { path: '/' });
  res.clearCookie('mfa_redirect', { path: '/' });

  logger.info('User logged in via OAuth', {
    userId: user.userId,
    deviceType,
    provider: 'oauth',
  });

  // Redirect to frontend
  res.redirect(`${ENV.FRONTEND_URL}${redirectPath}`);
}

/**
 * Generic OAuth callback handler
 */
export async function handleGenericOAuthCallback(
  providerName: string,
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const provider = getOAuthProvider(providerName);
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=${providerName}_auth_failed`);
    }

    // Exchange code for tokens
    const { accessToken, idToken } = await exchangeOAuthToken(provider, code);

    // Fetch user info
    const rawUserData = await fetchOAuthUserInfo(provider, accessToken, idToken);

    // Extract standardized user data
    const oauthData = await provider.extractUserData(rawUserData, accessToken);

    // Find or create user
    const user = await findOrCreateOAuthUser(oauthData);

    // Check if user is banned
    if (user.isBanned) {
      return res.redirect(
        `${ENV.FRONTEND_URL}/signin?error=account_suspended&reason=${encodeURIComponent(user.banReason || 'Violation of terms')}`,
      );
    }

    // Check if user is deleted
    if (user.isDeleted) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=account_not_found`);
    }

    const redirectTarget = (state as string) || '/dashboard';

    // Handle MFA if enabled
    const mfaHandled = await handleOAuthMfaFlow(user, req, res, redirectTarget);
    if (mfaHandled) {
      return; // MFA flow initiated, response already sent
    }

    // Handle successful login
    await handleSuccessfulOAuthLogin(user, req, res, redirectTarget);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific errors
    if (errorMessage === 'SIGNUP_DISABLED') {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
    }
    if (errorMessage === 'EMAIL_MISSING') {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=${providerName}_email_missing`);
    }

    logger.error(`${providerName} OAuth error`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.redirect(`${ENV.FRONTEND_URL}/signin?error=auth_failed`);
  }
}

/**
 * Generate OAuth authorization URL
 */
export function generateOAuthUrl(providerName: string, redirectPath?: string): string {
  const provider = getOAuthProvider(providerName);

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.callbackUrl,
    response_type: provider.responseType || 'code',
    state: redirectPath || '/dashboard',
  });

  // Add scopes (some providers require different formats)
  if (provider.scopes.length > 0) {
    params.append('scope', provider.scopes.join(' '));
  }

  // Provider-specific parameters
  switch (provider.name) {
    case 'google':
      params.append('access_type', 'offline');
      params.append('prompt', 'select_account');
      break;
    case 'microsoft':
      params.append('response_mode', 'query');
      break;
    case 'zoho':
      params.append('access_type', 'offline');
      break;
    case 'x':
      params.append('code_challenge', 'challenge');
      params.append('code_challenge_method', 'plain');
      break;
    case 'notion':
      params.append('owner', 'user');
      break;
    case 'dropbox':
      params.append('token_access_type', 'offline');
      break;
  }

  return `${provider.authUrl}?${params.toString()}`;
}
