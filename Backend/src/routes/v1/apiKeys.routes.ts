import { Router } from 'express';
import {
    createKey,
    deleteKey,
    getCurrentKey,
    listKeys,
    updateKey,
} from '../../controllers/v1/apiKeyController.js';
import { apiKeyAuth } from '../../middleware/apiKey.middleware.js';
import { protectRoute } from '../../middleware/auth.middleware.js';
import { requireSettingsVerification } from '../../middleware/verification.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: API Keys
 *   description: Manage API keys for programmatic access
 */

/**
 * @swagger
 * /api/v1/api-keys:
 *   get:
 *     summary: List all API keys
 *     description: Get all active API keys for the authenticated user
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     keys:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           keyPrefix:
 *                             type: string
 *                           expiresAt:
 *                             type: string
 *                             nullable: true
 *                           lastUsedAt:
 *                             type: string
 *                             nullable: true
 *                           createdAt:
 *                             type: string
 *                     total:
 *                       type: number
 *                     maxAllowed:
 *                       type: number
 */
router.get('/', protectRoute, listKeys);

/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     summary: Create a new API key
 *     description: Generate a new API key. The full key is only returned once!
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: A friendly name for the key
 *                 example: "Production API Key"
 *               expiresIn:
 *                 type: number
 *                 description: Days until expiration (1-365, null for never)
 *                 example: 90
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     key:
 *                       type: string
 *                       description: The full API key (only shown once!)
 *                     keyPrefix:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 */
router.post('/', protectRoute, requireSettingsVerification, createKey);

/**
 * @swagger
 * /api/v1/api-keys/current:
 *   get:
 *     summary: Get current API key info
 *     description: Get information about the API key used for authentication
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Current API key info
 */
router.get('/current', apiKeyAuth, getCurrentKey);

/**
 * @swagger
 * /api/v1/api-keys/{keyId}:
 *   patch:
 *     summary: Update API key name
 *     description: Update the name of an API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: API key updated successfully
 */
router.patch('/:keyId', protectRoute, requireSettingsVerification, updateKey);

/**
 * @swagger
 * /api/v1/api-keys/{keyId}:
 *   delete:
 *     summary: Revoke an API key
 *     description: Revoke (soft delete) an API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key revoked successfully
 */
router.delete('/:keyId', protectRoute, requireSettingsVerification, deleteKey);

export default router;
