import { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { Request, Response } from 'express';
import { z } from 'zod';
import { ENV } from '../../../config/env.js';
import logger from '../../../utils/logger.js';
import { getCachedUserInfo } from '../../../utils/userCache.js';
// Validation schema
const uploadRequestSchema = z.object({
    fileName: z.string().min(1).max(255),
    fileSize: z.number().positive().max(100 * 1024 * 1024), // 100MB max
    contentType: z.string().min(1),
});

// Allowed file types (whitelist approach)
const ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Text
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
];

const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.csv', '.zip'
];

/**
 * Generate a secure SAS token for direct upload to Azure Blob Storage
 * This implements the "Secure Upload Pattern" where:
 * 1. Client requests upload permission
 * 2. Server validates and generates time-limited SAS token
 * 3. Client uploads directly to Azure (no server bandwidth used)
 * 4. Server gets notified of upload completion
 */
export const generateUploadSasToken = async (req: Request, res: Response) => {
    try {
        const auth = await req.auth();
        const userId = auth?.userId;

        let userEmail: string | undefined;
        if (userId) {
            try {
                const user = await getCachedUserInfo(userId);
                userEmail = user?.email;
            } catch (error) {
                logger.error('Error fetching user details from Clerk', { error, userId });
            }
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Validate request body
        const validationResult = uploadRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request',
                errors: validationResult.error.issues,
            });
        }

        const { fileName, fileSize, contentType } = validationResult.data;

        // Validate file extension
        const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return res.status(400).json({
                success: false,
                message: `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
            });
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'File MIME type not allowed',
            });
        }

        // Get Azure Storage connection string from environment
        const connectionString = ENV.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = ENV.AZURE_STORAGE_CONTAINER_NAME;

        if (!connectionString || !containerName) {
            logger.error('Azure Storage connection string or container name not configured');
            return res.status(500).json({
                success: false,
                message: 'Upload service not configured',
            });
        }

        // Parse connection string to extract account name and key
        const parseConnectionString = (connStr: string) => {
            const parts = connStr.split(';').reduce((acc, part) => {
                const [key, value] = part.split('=');
                if (key && value) {
                    acc[key] = value;
                }
                return acc;
            }, {} as Record<string, string>);

            return {
                accountName: parts['AccountName'],
                accountKey: parts['AccountKey'],
            };
        };

        const { accountName, accountKey } = parseConnectionString(connectionString);

        if (!accountName || !accountKey) {
            logger.error('Invalid Azure Storage connection string');
            return res.status(500).json({
                success: false,
                message: 'Upload service misconfigured',
            });
        }

        // Create unique blob name with user context
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const blobName = `${userId}/${timestamp}-${sanitizedFileName}`;

        // Create shared key credential
        const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

        // Generate SAS token with minimal permissions (write only, 15 min expiry)
        const sasToken = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('w'), // Write only
                startsOn: new Date(),
                expiresOn: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
                contentType,
            },
            sharedKeyCredential
        ).toString();

        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

        // Log upload request for audit trail
        logger.info('Upload SAS token generated', {
            userId,
            userEmail,
            fileName: sanitizedFileName,
            fileSize,
            contentType,
            blobName,
        });

        return res.status(200).json({
            success: true,
            data: {
                uploadUrl,
                blobName,
                expiresIn: 900, // 15 minutes in seconds
            },
        });
    } catch (error) {
        logger.error('Error generating upload SAS token', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to generate upload token',
        });
    }
};

export const confirmUpload = async (req: Request, res: Response) => {
    try {
        const auth = await req.auth();
        const userId = auth?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const { blobName, supportTicketId } = req.body;

        if (!blobName) {
            return res.status(400).json({
                success: false,
                message: 'Blob name is required',
            });
        }

        // Verify blob exists and belongs to user
        if (!blobName.startsWith(`${userId}/`)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to blob',
            });
        }

        // TODO: Store blob reference in database with support ticket
        // This would typically involve:
        // 1. Verify blob exists in Azure
        // 2. Create database record linking blob to support ticket
        // 3. Optionally trigger virus scan
        // 4. Update support ticket with attachment info

        logger.info('Upload confirmed', {
            userId,
            blobName,
            supportTicketId,
        });

        return res.status(200).json({
            success: true,
            message: 'Upload confirmed successfully',
        });
    } catch (error) {
        logger.error('Error confirming upload', { error });
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm upload',
        });
    }
};
