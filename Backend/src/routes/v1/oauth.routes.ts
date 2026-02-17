/**
 * OAuth 2.0 / OpenID Connect Provider Routes
 *
 * Implements all OAuth provider endpoints with proper middleware.
 */

import { Router } from 'express';
import { optionalAuth, protectRoute } from '../../middleware/auth.middleware.js';
import {
  deviceAuthRateLimit,
  deviceConsentRateLimit,
  deviceVerifyRateLimit,
} from '../../middleware/deviceAuthRateLimit.middleware.js';
import { oauthBearerAuth } from '../../middleware/oauthBearer.middleware.js';
import {
  oauthClientAuth,
  requireConfidentialClient,
} from '../../middleware/oauthClient.middleware.js';

// Provider endpoints
import {
  authorizeEndpoint,
  consentEndpoint,
  deviceAuthorizeEndpoint,
  deviceConsentEndpoint,
  discoveryEndpoint,
  getAuthorizationRequest,
  getDeviceRequest,
  introspectEndpoint,
  jwksEndpoint,
  revokeEndpoint,
  tokenEndpoint,
  userinfoEndpoint,
} from '../../controllers/v1/oauthProviderController.js';

// Application management
import {
  createApplication,
  deleteApplication,
  getApplication,
  getApplicationPublicInfo,
  listApplications,
  regenerateSecret,
  updateApplication,
  verifyApplication,
} from '../../controllers/v1/oauthApplicationController.js';

// Consent management
import {
  getConsent,
  listConsents,
  listOAuthSessions,
  revokeConsent,
  revokeOAuthSession,
} from '../../controllers/v1/oauthConsentController.js';

const router = Router();

// ============================================
// DISCOVERY ENDPOINTS (Public, no auth)
// ============================================

// OpenID Connect Discovery
router.get('/openid-configuration', discoveryEndpoint);

// JSON Web Key Set
router.get('/jwks.json', jwksEndpoint);

// ============================================
// OAUTH FLOW ENDPOINTS
// ============================================

// Authorization endpoint - starts OAuth flow
// Optional auth: user may or may not be logged in
router.get('/authorize', optionalAuth, authorizeEndpoint);
router.post('/authorize', optionalAuth, authorizeEndpoint);

// Consent submission - requires authenticated user
router.post('/authorize/consent', protectRoute, consentEndpoint);

// Get authorization request details (for consent UI)
router.get('/authorize/request/:requestId', optionalAuth, getAuthorizationRequest);

// Token endpoint - requires client authentication
router.post('/token', oauthClientAuth, tokenEndpoint);

// UserInfo endpoint - requires valid Bearer token
router.get('/userinfo', oauthBearerAuth, userinfoEndpoint);
router.post('/userinfo', oauthBearerAuth, userinfoEndpoint);

// Token revocation - requires client authentication
router.post('/revoke', oauthClientAuth, revokeEndpoint);

// Token introspection - requires confidential client
router.post('/introspect', oauthClientAuth, requireConfidentialClient, introspectEndpoint);

// ============================================
// DEVICE AUTHORIZATION FLOW (RFC 8628)
// ============================================

// Device authorization endpoint - client initiates device flow
router.post('/device/authorize', oauthClientAuth, deviceAuthRateLimit, deviceAuthorizeEndpoint);

// Device verification endpoint - get device request details for consent UI (requires auth)
router.get('/device/verify', deviceVerifyRateLimit, protectRoute, getDeviceRequest);

// Device consent endpoint - user approves/denies device authorization
router.post('/device/consent', protectRoute, deviceConsentRateLimit, deviceConsentEndpoint);

// ============================================
// APPLICATION MANAGEMENT (Requires session auth)
// ============================================

// List user's OAuth applications
router.get('/applications', protectRoute, listApplications);

// Create new OAuth application
router.post('/applications', protectRoute, createApplication);

// Get application details
router.get('/applications/:id', protectRoute, getApplication);

// Update application
router.patch('/applications/:id', protectRoute, updateApplication);

// Delete application
router.delete('/applications/:id', protectRoute, deleteApplication);

// Regenerate client secret
router.post('/applications/:id/secret', protectRoute, regenerateSecret);

// Submit for verification
router.post('/applications/:id/verify', protectRoute, verifyApplication);

// Get public info for consent screen (no auth required)
router.get('/applications/:clientId/public', getApplicationPublicInfo);

// ============================================
// CONSENT MANAGEMENT (Requires session auth)
// ============================================

// List authorized applications
router.get('/consents', protectRoute, listConsents);

// Get consent details
router.get('/consents/:applicationId', protectRoute, getConsent);

// Revoke application access
router.delete('/consents/:applicationId', protectRoute, revokeConsent);

// ============================================
// SESSION MANAGEMENT (Requires session auth)
// ============================================

// List OAuth sessions (active tokens)
router.get('/sessions', protectRoute, listOAuthSessions);

// Revoke a specific OAuth session
router.delete('/sessions/:tokenId', protectRoute, revokeOAuthSession);

export default router;
