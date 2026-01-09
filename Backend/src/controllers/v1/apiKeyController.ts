import { Request, Response } from 'express';
import { z } from 'zod';
import {
    countUserApiKeys,
    createApiKey,
    listUserApiKeys,
    revokeApiKey,
    updateApiKeyName,
} from '../../services/apiKey.service.js';
import logger from '../../utils/logger.js';

// Validation schemas
const createApiKeySchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(50, 'Name must be 50 characters or less')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
    expiresIn: z.number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .nullable(),
});

const updateApiKeySchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(50, 'Name must be 50 characters or less')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
});

/**
 * Create a new API key
 * POST /api/v1/api-keys
 */
export const createKey = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Validate request body
        const validation = createApiKeySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.issues,
            });
        }

        const { name, expiresIn } = validation.data;

        // Create the API key
        const apiKey = await createApiKey(userId, name, {
            expiresIn: expiresIn || undefined,
            environment: 'live',
        });

        logger.info('API key created via API', { userId, keyId: apiKey.id });

        // IMPORTANT: fullKey is only returned once!
        return res.status(201).json({
            success: true,
            message: 'API key created successfully. Save the key now - it will not be shown again.',
            data: {
                id: apiKey.id,
                name: apiKey.name,
                key: apiKey.fullKey, // Only returned once!
                keyPrefix: apiKey.keyPrefix,
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle max keys error
        if (errorMessage.includes('Maximum')) {
            return res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }

        logger.error('Failed to create API key', { error: errorMessage });
        return res.status(500).json({
            success: false,
            message: 'Failed to create API key',
        });
    }
};

/**
 * List all API keys for the authenticated user
 * GET /api/v1/api-keys
 */
export const listKeys = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const apiKeys = await listUserApiKeys(userId);
        const count = await countUserApiKeys(userId);

        return res.status(200).json({
            success: true,
            data: {
                keys: apiKeys.map(key => ({
                    id: key.id,
                    name: key.name,
                    keyPrefix: key.keyPrefix,
                    expiresAt: key.expiresAt,
                    lastUsedAt: key.lastUsedAt,
                    createdAt: key.createdAt,
                })),
                total: count,
                maxAllowed: 10,
            },
        });
    } catch (error) {
        logger.error('Failed to list API keys', { error: (error as Error).message });
        return res.status(500).json({
            success: false,
            message: 'Failed to list API keys',
        });
    }
};

/**
 * Revoke (delete) an API key
 * DELETE /api/v1/api-keys/:keyId
 */
export const deleteKey = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const { keyId } = req.params;
        if (!keyId) {
            return res.status(400).json({
                success: false,
                message: 'Key ID is required',
            });
        }

        const revoked = await revokeApiKey(userId, keyId);

        if (!revoked) {
            return res.status(404).json({
                success: false,
                message: 'API key not found',
            });
        }

        logger.info('API key revoked via API', { userId, keyId });

        return res.status(200).json({
            success: true,
            message: 'API key revoked successfully',
        });
    } catch (error) {
        logger.error('Failed to revoke API key', { error: (error as Error).message });
        return res.status(500).json({
            success: false,
            message: 'Failed to revoke API key',
        });
    }
};

/**
 * Update API key name
 * PATCH /api/v1/api-keys/:keyId
 */
export const updateKey = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const { keyId } = req.params;
        if (!keyId) {
            return res.status(400).json({
                success: false,
                message: 'Key ID is required',
            });
        }

        // Validate request body
        const validation = updateApiKeySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.issues,
            });
        }

        const { name } = validation.data;

        const updated = await updateApiKeyName(userId, keyId, name);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'API key not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'API key updated successfully',
        });
    } catch (error) {
        logger.error('Failed to update API key', { error: (error as Error).message });
        return res.status(500).json({
            success: false,
            message: 'Failed to update API key',
        });
    }
};

/**
 * Get current API key info (for API key authenticated requests)
 * GET /api/v1/api-keys/current
 */
export const getCurrentKey = async (req: Request, res: Response) => {
    try {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                message: 'API key authentication required',
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: req.apiKey.id,
                name: req.apiKey.name,
                keyPrefix: req.apiKey.keyPrefix,
                userId: req.apiKey.userId,
                expiresAt: req.apiKey.expiresAt,
                lastUsedAt: req.apiKey.lastUsedAt,
                createdAt: req.apiKey.createdAt,
            },
        });
    } catch (error) {
        logger.error('Failed to get current API key info', { error: (error as Error).message });
        return res.status(500).json({
            success: false,
            message: 'Failed to get API key info',
        });
    }
};
