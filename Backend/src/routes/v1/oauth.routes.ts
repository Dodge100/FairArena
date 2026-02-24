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

/**
 * @swagger
 * /api/v1/oauth/openid-configuration:
 *   get:
 *     summary: OpenID Connect Discovery
 *     description: Retrieve the OpenID Connect provider configuration.
 *     tags: [OAuth Provider]
 *     responses:
 *       200:
 *         description: Discovery document
 */
router.get('/openid-configuration', discoveryEndpoint);

/**
 * @swagger
 * /api/v1/oauth/jwks.json:
 *   get:
 *     summary: JSON Web Key Set
 *     description: Retrieve the public keys used to sign ID tokens.
 *     tags: [OAuth Provider]
 *     responses:
 *       200:
 *         description: JWKS document
 */
router.get('/jwks.json', jwksEndpoint);

// ============================================
// OAUTH FLOW ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/v1/oauth/authorize:
 *   get:
 *     summary: OAuth 2.0 Authorization Endpoint
 *     description: Start the OAuth 2.0 authorization flow (Authorization Code or Implicit grant).
 *     tags: [OAuth Provider]
 *     parameters:
 *       - in: query
 *         name: client_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: response_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [code, token, id_token]
 *       - in: query
 *         name: scope
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: redirect_uri
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: nonce
 *         schema:
 *           type: string
 *       - in: query
 *         name: code_challenge
 *         schema:
 *           type: string
 *       - in: query
 *         name: code_challenge_method
 *         schema:
 *           type: string
 *           enum: [plain, S256]
 *     responses:
 *       302:
 *         description: Redirect to consent page or client redirect URI
 *       400:
 *         description: Invalid request
 */
router.get('/authorize', optionalAuth, authorizeEndpoint);
router.post('/authorize', optionalAuth, authorizeEndpoint);

/**
 * @swagger
 * /api/v1/oauth/authorize/consent:
 *   post:
 *     summary: Submit OAuth Consent
 *     description: Submit user's approval or denial for an OAuth authorization request.
 *     tags: [OAuth Provider]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [request_id, action]
 *             properties:
 *               request_id:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [approve, deny]
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Consent processed, redirect URL returned
 *       400:
 *         description: Invalid request
 */
router.post('/authorize/consent', protectRoute, consentEndpoint);

/**
 * @swagger
 * /api/v1/oauth/authorize/request/{requestId}:
 *   get:
 *     summary: Get Authorization Request Details
 *     description: Retrieve details about an ongoing authorization request for display on the consent screen.
 *     tags: [OAuth Provider]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request details retrieved
 */
router.get('/authorize/request/:requestId', optionalAuth, getAuthorizationRequest);

/**
 * @swagger
 * /api/v1/oauth/token:
 *   post:
 *     summary: OAuth 2.0 Token Endpoint
 *     description: Exchange authorization codes or refresh tokens for access tokens.
 *     tags: [OAuth Provider]
 *     security: []
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [grant_type]
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [authorization_code, refresh_token, client_credentials, urn:ietf:params:oauth:grant-type:device_code]
 *               code:
 *                 type: string
 *               refresh_token:
 *                 type: string
 *               client_id:
 *                 type: string
 *               client_secret:
 *                 type: string
 *               redirect_uri:
 *                 type: string
 *               code_verifier:
 *                 type: string
 *               device_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token response
 *       400:
 *         description: Invalid grant or request
 *       401:
 *         description: Invalid client
 */
router.post('/token', oauthClientAuth, tokenEndpoint);

/**
 * @swagger
 * /api/v1/oauth/userinfo:
 *   get:
 *     summary: OpenID Connect UserInfo
 *     description: Retrieve claims about the authenticated end-user.
 *     tags: [OAuth Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User claims
 *       401:
 *         description: Invalid token
 */
router.get('/userinfo', oauthBearerAuth, userinfoEndpoint);
router.post('/userinfo', oauthBearerAuth, userinfoEndpoint);

/**
 * @swagger
 * /api/v1/oauth/revoke:
 *   post:
 *     summary: OAuth 2.0 Token Revocation
 *     description: Revoke an access token or refresh token.
 *     tags: [OAuth Provider]
 *     security: []
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *               token_type_hint:
 *                 type: string
 *                 enum: [access_token, refresh_token]
 *               client_id:
 *                 type: string
 *               client_secret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token revoked
 */
router.post('/revoke', oauthClientAuth, revokeEndpoint);

/**
 * @swagger
 * /api/v1/oauth/introspect:
 *   post:
 *     summary: OAuth 2.0 Token Introspection
 *     description: Determine the active state of an OAuth 2.0 token and its metadata.
 *     tags: [OAuth Provider]
 *     security: []
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *               token_type_hint:
 *                 type: string
 *                 enum: [access_token, refresh_token]
 *               client_id:
 *                 type: string
 *               client_secret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token status
 */
router.post('/introspect', oauthClientAuth, requireConfidentialClient, introspectEndpoint);

// ============================================
// DEVICE AUTHORIZATION FLOW (RFC 8628)
// ============================================

/**
 * @swagger
 * /api/v1/oauth/device/authorize:
 *   post:
 *     summary: OAuth 2.0 Device Authorization Endpoint
 *     description: Client initiates the device authorization flow.
 *     tags: [OAuth Provider, Device Flow]
 *     security: []
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [client_id]
 *             properties:
 *               client_id:
 *                 type: string
 *               scope:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device authorization response (user_code, device_code)
 */
router.post('/device/authorize', oauthClientAuth, deviceAuthRateLimit, deviceAuthorizeEndpoint);

/**
 * @swagger
 * /api/v1/oauth/device/verify:
 *   get:
 *     summary: Verify User Code for Device Flow
 *     description: Retrieve details about a device authorization request for the user to approve or deny.
 *     tags: [OAuth Provider, Device Flow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Device request details retrieved
 *       404:
 *         description: Invalid or expired user code
 */
router.get('/device/verify', deviceVerifyRateLimit, protectRoute, getDeviceRequest);

/**
 * @swagger
 * /api/v1/oauth/device/consent:
 *   post:
 *     summary: Device Flow Consent
 *     description: User approves or denies the device authorization request.
 *     tags: [OAuth Provider, Device Flow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_code, action]
 *             properties:
 *               user_code:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [approve, deny]
 *     responses:
 *       200:
 *         description: Device consent processed
 */
router.post('/device/consent', protectRoute, deviceConsentRateLimit, deviceConsentEndpoint);

// ============================================
// APPLICATION MANAGEMENT (Requires session auth)
// ============================================

/**
 * @swagger
 * /api/v1/oauth/applications:
 *   get:
 *     summary: List OAuth Applications
 *     description: Retrieve all OAuth applications created by the authenticated user.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applications
 */
router.get('/applications', protectRoute, listApplications);

/**
 * @swagger
 * /api/v1/oauth/applications:
 *   post:
 *     summary: Create OAuth Application
 *     description: Register a new OAuth 2.0 application.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [public, confidential]
 *               redirectUris:
 *                 type: array
 *                 items:
 *                   type: string
 *               websiteUrl:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application created
 */
router.post('/applications', protectRoute, createApplication);

/**
 * @swagger
 * /api/v1/oauth/applications/{id}:
 *   get:
 *     summary: Get Application Details
 *     description: Retrieve detailed information about a specific OAuth application.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details
 */
router.get('/applications/:id', protectRoute, getApplication);

/**
 * @swagger
 * /api/v1/oauth/applications/{id}:
 *   patch:
 *     summary: Update Application
 *     description: Modify settings for an existing OAuth application.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               redirectUris:
 *                 type: array
 *                 items:
 *                   type: string
 *               websiteUrl:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application updated
 */
router.patch('/applications/:id', protectRoute, updateApplication);

/**
 * @swagger
 * /api/v1/oauth/applications/{id}:
 *   delete:
 *     summary: Delete Application
 *     description: Permanently remove an OAuth application and revoke all its tokens.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application deleted
 */
router.delete('/applications/:id', protectRoute, deleteApplication);

/**
 * @swagger
 * /api/v1/oauth/applications/{id}/secret:
 *   post:
 *     summary: Regenerate Client Secret
 *     description: Issue a new client secret for a confidential application.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: New secret generated
 */
router.post('/applications/:id/secret', protectRoute, regenerateSecret);

/**
 * @swagger
 * /api/v1/oauth/applications/{id}/verify:
 *   post:
 *     summary: Verify OAuth Application
 *     description: Submit an OAuth application for administrative verification.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification submitted
 */
router.post('/applications/:id/verify', protectRoute, verifyApplication);

/**
 * @swagger
 * /api/v1/oauth/applications/{clientId}/public:
 *   get:
 *     summary: Get Public Application Info
 *     description: Retrieve public-facing information about an application for the consent screen.
 *     tags: [OAuth Management]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public application info
 */
router.get('/applications/:clientId/public', getApplicationPublicInfo);

// ============================================
// CONSENT MANAGEMENT (Requires session auth)
// ============================================

/**
 * @swagger
 * /api/v1/oauth/consents:
 *   get:
 *     summary: List User Consents
 *     description: Retrieve all applications that the authenticated user has authorized.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of consents
 */
router.get('/consents', protectRoute, listConsents);

/**
 * @swagger
 * /api/v1/oauth/consents/{applicationId}:
 *   get:
 *     summary: Get Consent Details
 *     description: Retrieve specific authorization details for an application.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consent details
 */
router.get('/consents/:applicationId', protectRoute, getConsent);

/**
 * @swagger
 * /api/v1/oauth/consents/{applicationId}:
 *   delete:
 *     summary: Revoke Application Access
 *     description: Revoke all access granted to a specific application by the user.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Access revoked
 */
router.delete('/consents/:applicationId', protectRoute, revokeConsent);

// ============================================
// SESSION MANAGEMENT (Requires session auth)
// ============================================

/**
 * @swagger
 * /api/v1/oauth/sessions:
 *   get:
 *     summary: List OAuth Sessions
 *     description: Retrieve all active access tokens and refresh tokens for the user.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of OAuth sessions
 */
router.get('/sessions', protectRoute, listOAuthSessions);

/**
 * @swagger
 * /api/v1/oauth/sessions/{tokenId}:
 *   delete:
 *     summary: Revoke OAuth Session
 *     description: Revoke a specific access token or refresh token.
 *     tags: [OAuth Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token revoked
 */
router.delete('/sessions/:tokenId', protectRoute, revokeOAuthSession);

export default router;
