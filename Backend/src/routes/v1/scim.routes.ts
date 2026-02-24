import { Router } from 'express';
import * as scimController from '../../controllers/v1/scimController.js';
import { protectRoute } from '../../middleware/auth.middleware.js';

const router = Router();

// Apply authentication to all SCIM routes
router.use(protectRoute);

/**
 * @swagger
 * tags:
 *   name: SCIM
 *   description: System for Cross-domain Identity Management (RFC 7643/7644)
 */

/**
 * @swagger
 * /api/v1/scim/Users:
 *   get:
 *     summary: List SCIM Users
 *     description: Retrieve a paginated list of users using SCIM protocol.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of SCIM users retrieved successfully
 *   post:
 *     summary: Create SCIM User
 *     description: Create a new user using SCIM protocol.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.get('/Users', scimController.getUsers);
router.post('/Users', scimController.createUser);

/**
 * @swagger
 * /api/v1/scim/Users/{id}:
 *   get:
 *     summary: Get SCIM User
 *     description: Retrieve a specific user by their SCIM identifier.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *   put:
 *     summary: Update SCIM User
 *     description: Replace a user's details using SCIM PUT protocol.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User updated successfully
 *   patch:
 *     summary: Patch SCIM User
 *     description: Partially update a user's details using SCIM PATCH protocol.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User patched successfully
 *   delete:
 *     summary: Delete SCIM User
 *     description: Remove a user via SCIM identifier.
 *     tags: [SCIM]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       204:
 *         description: User deleted successfully
 */
router.get('/Users/:id', scimController.getUser);
router.put('/Users/:id', scimController.updateUser);
router.patch('/Users/:id', scimController.patchUser);
router.delete('/Users/:id', scimController.deleteUser);

/**
 * @swagger
 * /api/v1/scim/ServiceProviderConfig:
 *   get:
 *     summary: Get SCIM Service Provider Config
 *     description: Retrieve the SCIM capabilities and configuration of the service provider.
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Service provider configuration retrieved successfully
 */
router.get('/ServiceProviderConfig', (req, res) => {
  res.set('Content-Type', 'application/scim+json').json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard',
        specUri: 'http://www.rfc-editor.org/info/rfc6750',
        type: 'oauthbearertoken',
        primary: true,
      },
    ],
  });
});

export default router;
