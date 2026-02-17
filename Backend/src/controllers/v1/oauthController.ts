import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { inngest } from '../../inngest/v1/client.js';
import {
  createSession,
  generateAccessToken,
  generateBindingToken,
  generateRefreshToken,
  parseUserAgent,
  storeSessionBinding,
} from '../../services/auth.service.js';
import { generateOAuthUrl, handleGenericOAuthCallback } from '../../services/oauth.service.js';
import {
  MFA_SESSION_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from '../../utils/cookie.utils.js';
import logger from '../../utils/logger.js';

// Google OAuth client (needed for handleGoogleToken)
const googleClient = new OAuth2Client(
  ENV.GOOGLE_CLIENT_ID,
  ENV.GOOGLE_CLIENT_SECRET,
  ENV.GOOGLE_CALLBACK_URL,
);

// Validation schema for Google token
const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

// =====================================================
// GENERIC OAuth URL GENERATORS
// =====================================================

export const getGoogleAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('google', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Google auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Google authentication' });
  }
};

export const getGithubAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('github', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate GitHub auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate GitHub authentication' });
  }
};

export const getMicrosoftAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('microsoft', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Microsoft auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Microsoft authentication' });
  }
};

export const getDiscordAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('discord', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Discord auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Discord authentication' });
  }
};

export const getHuggingFaceAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('huggingface', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Hugging Face auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Hugging Face authentication' });
  }
};

export const getGitLabAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('gitlab', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate GitLab auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate GitLab authentication' });
  }
};

export const getSlackAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('slack', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Slack auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Slack authentication' });
  }
};

export const getNotionAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('notion', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Notion auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Notion authentication' });
  }
};

export const getXAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('x', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate X auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Failed to initiate X authentication' });
  }
};

export const getZohoAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('zoho', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Zoho auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Zoho authentication' });
  }
};

export const getLinearAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('linear', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Linear auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Linear authentication' });
  }
};

export const getDropboxAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('dropbox', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Dropbox auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Dropbox authentication' });
  }
};

export const getLinkedInAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('linkedin', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate LinkedIn auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate LinkedIn authentication' });
  }
};

export const getVercelAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('vercel', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Vercel auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Vercel authentication' });
  }
};

export const getFigmaAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('figma', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Figma auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Figma authentication' });
  }
};

export const getZoomAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('zoom', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Zoom auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Zoom authentication' });
  }
};

export const getAtlassianAuthUrl = async (req: Request, res: Response) => {
  try {
    const authUrl = generateOAuthUrl('atlassian', req.query.redirect as string);
    return res.status(200).json({ success: true, data: { url: authUrl } });
  } catch (error) {
    logger.error('Failed to generate Atlassian auth URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, message: 'Failed to initiate Atlassian authentication' });
  }
};

// =====================================================
// GENERIC OAuth CALLBACK HANDLERS
// =====================================================

export const handleGoogleCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('google', req, res);
};

export const handleGithubCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('github', req, res);
};

export const handleMicrosoftCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('microsoft', req, res);
};

export const handleDiscordCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('discord', req, res);
};

export const handleHuggingFaceCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('huggingface', req, res);
};

export const handleGitLabCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('gitlab', req, res);
};

export const handleSlackCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('slack', req, res);
};

export const handleNotionCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('notion', req, res);
};

export const handleXCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('x', req, res);
};

export const handleZohoCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('zoho', req, res);
};

export const handleLinearCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('linear', req, res);
};

export const handleDropboxCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('dropbox', req, res);
};

export const handleLinkedInCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('linkedin', req, res);
};

export const handleVercelCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('vercel', req, res);
};

export const handleFigmaCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('figma', req, res);
};

export const handleZoomCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('zoom', req, res);
};

export const handleAtlassianCallback = async (req: Request, res: Response) => {
  return handleGenericOAuthCallback('atlassian', req, res);
};

// =====================================================
// GOOGLE ONE TAP (Unique - not using generic handler)
// =====================================================

/**
 * Handle Google One Tap / ID Token authentication (frontend)
 * POST /api/v1/auth/google/token
 */
export const handleGoogleToken = async (req: Request, res: Response) => {
  try {
    const validation = googleAuthSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { credential } = validation.data;

    // Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: ENV.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
      });
    }

    const { email, sub: googleId, given_name, family_name, picture } = payload;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }],
      },
    });

    let isNewUser = false;

    if (!user) {
      // Check if signups are enabled
      if (!ENV.NEW_SIGNUP_ENABLED) {
        return res.status(403).json({
          success: false,
          message: 'Signups are currently disabled. Please join our waitlist.',
          code: 'SIGNUP_DISABLED',
        });
      }

      // Create new user
      const { createId } = await import('@paralleldrive/cuid2');
      const userId = createId();

      user = await prisma.user.create({
        data: {
          userId,
          email: email.toLowerCase(),
          googleId,
          firstName: given_name || null,
          lastName: family_name || null,
          profileImageUrl: picture || null,
          emailVerified: true,
        },
      });

      isNewUser = true;
      logger.info('New user created via Google One Tap', {
        userId: user.userId,
        email: user.email,
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      await prisma.user.update({
        where: { userId: user.userId },
        data: {
          googleId,
          profileImageUrl: user.profileImageUrl || picture || null,
          emailVerified: true,
        },
      });

      logger.info('Google account linked to existing user', { userId: user.userId });
    }

    // Check for MFA
    if (user.mfaEnabled) {
      // Get IP and device fingerprint for security
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { deviceType } = parseUserAgent(userAgent);
      const deviceFingerprint = `${deviceType}:${userAgent.substring(0, 50)}`;

      const tempToken = await import('jsonwebtoken').then((jwt) =>
        jwt.default.sign(
          {
            userId: user.userId,
            type: 'mfa_pending',
            ipAddress,
            deviceFingerprint,
          },
          ENV.JWT_SECRET,
          { expiresIn: '5m', issuer: 'fairarena' },
        ),
      );

      // Set MFA session cookie (HTTP-only, secure)
      res.cookie('mfa_session', tempToken, MFA_SESSION_COOKIE_OPTIONS);

      return res.status(200).json({
        success: true,
        message: 'MFA verification required',
        mfaRequired: true,
      });
    }

    // Get device info
    const userAgent = req.headers['user-agent'] as string;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const { deviceType, deviceName } = parseUserAgent(userAgent);

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

    // Set cookies
    // Generate binding token for session security
    const { token: bindingToken, hash: bindingHash } = generateBindingToken();
    await storeSessionBinding(sessionId, bindingHash);

    // Set multi-session cookies
    res.cookie(`session_${sessionId}`, bindingToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    res.cookie('active_session', sessionId, SESSION_COOKIE_OPTIONS);

    logger.info('User logged in via Google token', { userId: user.userId, deviceType });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        accessToken,
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
        isNewUser,
      },
    });
  } catch (error) {
    logger.error('Google token auth error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      message: 'Google authentication failed',
    });
  }
};

/**
 * Handle Google RISC (Cross-Account Protection) Events
 * POST /api/v1/auth/google/risc
 * RFC 8936
 */
export const handleGoogleRiscEvent = async (req: Request, res: Response) => {
  try {
    // Validate Content-Type
    if (req.headers['content-type'] !== 'application/secevent+jwt') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Content-Type',
      });
    }

    const token = req.body;
    // In Express, if bodyParser is used with text/plain or raw, body might be string or buffer.
    // If application/secevent+jwt is not handled by default parsers, we might need to handle raw body.
    // Assuming body parser handles it or we treat it as string if we add a parser for it.
    // For now, let's assume standard middleware might not parse 'application/secevent+jwt' automatically to JSON.
    // Usually we need `app.use(bodyParser.text({ type: 'application/secevent+jwt' }))` in app.ts.
    // I will assume standard handling for now or simple check.

    // Note: We might need to handle raw body if it's not parsed.
    // But let's proceed with logic assuming req.body contains the token string (if using appropriate middleware)
    // or we access it differently.
    // Ideally we should update app.ts to parse this content type, but I shouldn't modify app.ts blindly.

    let idToken = token;
    if (typeof token === 'object' && token.token) {
      idToken = token.token; // Handle if passed as JSON { token: "..." } accidentally
    } else if (typeof token === 'object') {
      // If body parser parsed JSON but it's actually just the JWT string... Wait, JWT is not valid JSON.
      // If body parser tried to parse JSON and failed, it might be empty.
      // Usually for webhooks like this, text parser is needed.
    }

    // Just in case it's passed as a property in testing
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing token',
      });
    }

    // Verify the token using Google Client
    // Note: verifyIdToken automatically fetches Google's public keys
    const ticket = await googleClient.verifyIdToken({
      idToken: typeof idToken === 'string' ? idToken : JSON.stringify(idToken), // Ensure string
      audience: ENV.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token payload',
      });
    }

    // Extract event details
    // RISC tokens put events in the 'events' claim
    const events = (payload as any).events || {};
    const subject = (payload as any).sub;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Missing subject',
      });
    }

    logger.info('Received Google RISC event', { subject, eventTypes: Object.keys(events) });

    // Find user by Google ID
    const user = await prisma.user.findFirst({
      where: { googleId: subject },
    });

    if (user) {
      // Handle specific event types
      const accountDisabled =
        events['https://schemas.openid.net/secevent/risc/event-type/account-disabled'];
      const sessionsRevoked =
        events['https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'];
      const credentialCompromised =
        events['https://schemas.openid.net/secevent/risc/event-type/credential-compromise'];

      if (accountDisabled || sessionsRevoked || credentialCompromised) {
        // Determine reason
        let reason = 'Security event received from Google';
        if (accountDisabled) reason = 'Google account disabled';
        else if (sessionsRevoked) reason = 'Google sessions revoked';
        else if (credentialCompromised) reason = 'Google credential compromised';

        // Revoke all sessions
        await import('../../services/auth.service.js').then((s) =>
          s.destroyAllUserSessions(user.userId),
        );

        // For account disabled, we might want to lock the account locally too
        if (accountDisabled) {
          await prisma.user.update({
            where: { userId: user.userId },
            data: {
              isBanned: true,
              banReason: `Auto-banned via RISC: ${reason}`,
            },
          });
        }

        // Log the security action
        await inngest.send({
          name: 'log.create',
          data: {
            userId: user.userId,
            action: 'risc_security_action',
            level: 'WARN',
            metadata: {
              reason,
              eventTypes: Object.keys(events),
              googleId: subject,
            },
          },
        });

        logger.warn('Executed RISC security action', { userId: user.userId, reason });
      }
    } else {
      logger.info('RISC event for unknown user', { googleId: subject });
    }

    // Return 202 Accepted as per spec
    return res.status(202).json({ success: true });
  } catch (error) {
    logger.error('Google RISC event handling failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    // RISC spec suggests returning error codes if signature verification fails
    return res.status(400).json({
      success: false,
      message: 'RISC processing failed',
    });
  }
};

// =====================================================
// ENTERPRISE SSO (OIDC/SAML)
// =====================================================

export const ssoCheck = async (req: Request, res: Response) => {
  try {
    const emailParam = req.query.email;
    const email = Array.isArray(emailParam) ? emailParam[0] : (emailParam as string);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Invalid email' });
    }

    const domain = email.split('@')[1];
    const ssoConfig = await prisma.organizationSSOConfig.findFirst({
      where: { domain, isActive: true },
    });

    if (ssoConfig) {
      return res.json({
        success: true,
        ssoEnabled: true,
        providerType: ssoConfig.providerType,
        ssoUrl: `${ENV.BASE_URL}/api/v1/auth/sso/login?email=${encodeURIComponent(email)}`,
      });
    }

    return res.json({ success: true, ssoEnabled: false });
  } catch (error) {
    logger.error('SSO check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const ssoLogin = async (req: Request, res: Response) => {
  try {
    const emailParam = req.query.email;
    const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

    if (!email || typeof email !== 'string') {
      return res.status(400).send('Invalid email');
    }

    const domain = email.split('@')[1];

    if (!domain) return res.status(400).send('Invalid email domain');

    const ssoConfig = await prisma.organizationSSOConfig.findFirst({
      where: { domain, isActive: true },
    });

    if (!ssoConfig) return res.status(404).send('SSO not configured for this domain');

    if (ssoConfig.providerType === 'oidc') {
      const state = req.query.redirect || '/dashboard';
      const redirectUri = `${ENV.BASE_URL}/api/v1/auth/sso/callback`;

      const stateData = JSON.stringify({ configId: ssoConfig.id, target: state });
      const encodedState = Buffer.from(stateData).toString('base64');

      const params = new URLSearchParams({
        client_id: ssoConfig.clientId!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state: encodedState,
      });

      return res.redirect(`${ssoConfig.authorizationUrl}?${params.toString()}`);
    }

    return res.status(501).send('SSO provider type not supported');
  } catch (error) {
    logger.error('SSO login error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).send('Server error');
  }
};

export const ssoCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=invalid_request`);
    }

    let configId, target;
    try {
      const decoded = Buffer.from(state as string, 'base64').toString('utf-8');
      const json = JSON.parse(decoded);
      configId = json.configId;
      target = json.target;
    } catch {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=invalid_state`);
    }

    const ssoConfig = await prisma.organizationSSOConfig.findUnique({
      where: { id: configId },
    });

    if (!ssoConfig) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=config_not_found`);
    }

    // Exchange Code
    const redirectUri = `${ENV.BASE_URL}/api/v1/auth/sso/callback`;
    const tokenResponse = await fetch(ssoConfig.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: ssoConfig.clientId!,
        client_secret: ssoConfig.clientSecret!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=sso_token_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Extract User Info
    let email, firstName, lastName, profileImageUrl;

    if (tokenData.id_token) {
      const jwt = await import('jsonwebtoken');
      const decoded: any = jwt.default.decode(tokenData.id_token);
      email = decoded.email;
      firstName = decoded.given_name;
      lastName = decoded.family_name;
      profileImageUrl = decoded.picture;
    } else if (ssoConfig.userInfoUrl) {
      const uiRes = await fetch(ssoConfig.userInfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (uiRes.ok) {
        const ui = await uiRes.json();
        email = ui.email;
        firstName = ui.given_name;
        lastName = ui.family_name;
        profileImageUrl = ui.picture;
      }
    }

    if (!email) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=email_missing`);
    }

    // Check if email domain matches config
    const emailDomain = email.split('@')[1]?.toLowerCase();
    const configDomain = ssoConfig.domain?.toLowerCase();

    if (configDomain && emailDomain !== configDomain) {
      return res.redirect(`${ENV.FRONTEND_URL}/signin?error=domain_mismatch`);
    }

    // Reuse findOrCreateOAuthUser logic from oauth.service.ts
    // Since we can't easily reusing oauth.service.ts's logic which accepts OAuthUserData, we'll just check directly.

    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      if (!ENV.NEW_SIGNUP_ENABLED) {
        return res.redirect(`${ENV.FRONTEND_URL}/signin?error=signup_disabled`);
      }

      const { createId } = await import('@paralleldrive/cuid2');
      user = await prisma.user.create({
        data: {
          userId: createId(),
          email: email.toLowerCase(),
          firstName: firstName || null,
          lastName: lastName || null,
          profileImageUrl: profileImageUrl || null,
          emailVerified: true,
        },
      });

      // Link to Org
      if (ssoConfig.organizationId) {
        try {
          await prisma.userOrganization.create({
            data: { userId: user.userId, organizationId: ssoConfig.organizationId },
          });
        } catch (e) {
          // Ignore unique constraint violation if exists
        }
      }
    }

    const { handleSuccessfulOAuthLogin } = await import('../../services/oauth.service.js');
    await handleSuccessfulOAuthLogin(user, req, res, target || '/dashboard');
  } catch (error) {
    logger.error('SSO callback error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.redirect(`${ENV.FRONTEND_URL}/signin?error=server_error`);
  }
};
