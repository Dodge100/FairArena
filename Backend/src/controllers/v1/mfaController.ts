import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { inngest } from '../../inngest/v1/client.js';
import { verifyPassword } from '../../services/auth.service.js';
import {
    generateMFASetup,
    verifyBackupCode,
    verifyTOTPCode,
} from '../../services/mfa.service.js';
import logger from '../../utils/logger.js';

// Validation schemas
const verifySetupSchema = z.object({
    code: z.string().length(6, 'Code must be 6 digits'),
});

const verifyMFASchema = z.object({
    code: z.string().min(6).max(10),
    isBackupCode: z.boolean().optional(),
});

const disableMFASchema = z.object({
    password: z.string().min(1, 'Password is required'),
    code: z.string().length(6, 'Code must be 6 digits'),
});

/**
 * Start MFA setup - returns QR code and backup codes
 * POST /api/v1/mfa/setup
 */
export const startMFASetup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        // Check if MFA is already enabled
        const user = await prisma.user.findUnique({
            where: { userId },
            select: { email: true, mfaEnabled: true },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: 'MFA is already enabled. Disable it first to set up again.',
            });
        }

        // Generate MFA setup data
        const setupData = await generateMFASetup(user.email);

        // Store encrypted secret temporarily (will be confirmed when verified)
        // We store it directly but mark mfaEnabled as false until verified
        await prisma.user.update({
            where: { userId },
            data: {
                mfaSecret: setupData.encryptedSecret,
                mfaBackupCodes: setupData.hashedBackupCodes,
            },
        });

        logger.info('MFA setup initiated', { userId });

        return res.status(200).json({
            success: true,
            message: 'MFA setup initiated. Scan the QR code and enter the verification code.',
            data: {
                qrCode: setupData.qrCode,
                backupCodes: setupData.backupCodes,
                manualEntryKey: setupData.secret, // For manual entry
            },
        });
    } catch (error) {
        logger.error('MFA setup error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred during MFA setup',
        });
    }
};

/**
 * Complete MFA setup by verifying the first code
 * POST /api/v1/mfa/verify-setup
 */
export const verifyMFASetup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const validation = verifySetupSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        const { code } = validation.data;

        // Get user's pending MFA secret
        const user = await prisma.user.findUnique({
            where: { userId },
            select: { mfaSecret: true, mfaEnabled: true },
        });

        if (!user || !user.mfaSecret) {
            return res.status(400).json({
                success: false,
                message: 'No MFA setup in progress. Please start setup first.',
            });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: 'MFA is already enabled.',
            });
        }

        // Verify the code
        const isValid = verifyTOTPCode(code, user.mfaSecret);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code. Please try again.',
            });
        }

        // Enable MFA
        await prisma.user.update({
            where: { userId },
            data: {
                mfaEnabled: true,
                mfaEnabledAt: new Date(),
            },
        });

        // Get device info for notification
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        // Send in-app notification
        await inngest.send({
            name: 'notification/send',
            data: {
                userId,
                title: 'Two-Factor Authentication Enabled',
                message: 'Two-factor authentication has been successfully enabled on your account',
                description: 'Your account is now more secure. You\'ll need your authenticator app when signing in.',
                actionUrl: '/dashboard/account-settings',
                actionLabel: 'View Security Settings',
                metadata: {
                    type: 'security',
                    action: 'mfa_enabled',
                    ipAddress,
                    userAgent: userAgent?.substring(0, 200),
                },
            },
        });

        // Send email notification
        await inngest.send({
            name: 'email/mfa-enabled',
            data: {
                userId,
                ipAddress,
                userAgent,
            },
        });

        // Log activity
        await inngest.send({
            name: 'log.create',
            data: {
                userId,
                action: 'mfa-enabled',
                level: 'INFO',
                metadata: {
                    ipAddress,
                    userAgent: userAgent?.substring(0, 200),
                    timestamp: new Date().toISOString(),
                },
            },
        });

        logger.info('MFA enabled successfully', { userId });

        return res.status(200).json({
            success: true,
            message: 'Two-factor authentication has been enabled successfully!',
        });
    } catch (error) {
        logger.error('MFA verify setup error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred during MFA verification',
        });
    }
};

/**
 * Verify MFA code during login
 * POST /api/v1/mfa/verify
 */
export const verifyMFA = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const validation = verifyMFASchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        const { code, isBackupCode } = validation.data;

        const user = await prisma.user.findUnique({
            where: { userId },
            select: { mfaSecret: true, mfaBackupCodes: true, mfaEnabled: true },
        });

        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            return res.status(400).json({
                success: false,
                message: 'MFA is not enabled for this account.',
            });
        }

        let isValid = false;

        if (isBackupCode) {
            // Verify backup code
            const codeIndex = verifyBackupCode(code.replace(/[^A-Z0-9]/g, '').toUpperCase(), user.mfaBackupCodes);
            if (codeIndex >= 0) {
                isValid = true;
                // Remove used backup code
                const updatedCodes = [...user.mfaBackupCodes];
                updatedCodes.splice(codeIndex, 1);
                await prisma.user.update({
                    where: { userId },
                    data: { mfaBackupCodes: updatedCodes },
                });

                logger.info('Backup code used', { userId, remainingCodes: updatedCodes.length });
            }
        } else {
            // Verify TOTP code
            isValid = verifyTOTPCode(code, user.mfaSecret);
        }

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Verification successful',
        });
    } catch (error) {
        logger.error('MFA verify error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification',
        });
    }
};

/**
 * Disable MFA (requires password and current TOTP code)
 * POST /api/v1/mfa/disable
 */
export const disableMFA = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const validation = disableMFASchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        const { password, code } = validation.data;

        const user = await prisma.user.findUnique({
            where: { userId },
            select: { passwordHash: true, mfaSecret: true, mfaEnabled: true },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        if (!user.mfaEnabled) {
            return res.status(400).json({
                success: false,
                message: 'MFA is not enabled.',
            });
        }

        // Verify password
        if (!user.passwordHash) {
            return res.status(400).json({
                success: false,
                message: 'Cannot disable MFA without a password. Please set a password first.',
            });
        }

        const passwordValid = await verifyPassword(password, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password.',
            });
        }

        // Verify TOTP code
        if (!user.mfaSecret || !verifyTOTPCode(code, user.mfaSecret)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code.',
            });
        }

        // Disable MFA
        await prisma.user.update({
            where: { userId },
            data: {
                mfaEnabled: false,
                mfaSecret: null,
                mfaBackupCodes: [],
                mfaEnabledAt: null,
            },
        });

        // Get device info for notification
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        // Send in-app notification
        await inngest.send({
            name: 'notification/send',
            data: {
                userId,
                title: 'Two-Factor Authentication Disabled',
                message: 'Two-factor authentication has been disabled on your account',
                description: 'Your account security level has been reduced. We strongly recommend re-enabling 2FA.',
                actionUrl: '/dashboard/account-settings',
                actionLabel: 'Re-enable 2FA',
                metadata: {
                    type: 'security',
                    action: 'mfa_disabled',
                    ipAddress,
                    userAgent: userAgent?.substring(0, 200),
                },
            },
        });

        // Send email notification
        await inngest.send({
            name: 'email/mfa-disabled',
            data: {
                userId,
                ipAddress,
                userAgent,
            },
        });

        // Log activity
        await inngest.send({
            name: 'log.create',
            data: {
                userId,
                action: 'mfa-disabled',
                level: 'WARN',
                metadata: {
                    ipAddress,
                    userAgent: userAgent?.substring(0, 200),
                    timestamp: new Date().toISOString(),
                },
            },
        });

        logger.info('MFA disabled', { userId });

        return res.status(200).json({
            success: true,
            message: 'Two-factor authentication has been disabled.',
        });
    } catch (error) {
        logger.error('MFA disable error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred while disabling MFA',
        });
    }
};

/**
 * Get MFA status
 * GET /api/v1/mfa/status
 */
export const getMFAStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const user = await prisma.user.findUnique({
            where: { userId },
            select: {
                mfaEnabled: true,
                mfaEnabledAt: true,
                mfaBackupCodes: true,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                enabled: user.mfaEnabled,
                enabledAt: user.mfaEnabledAt,
                backupCodesRemaining: user.mfaBackupCodes?.length || 0,
            },
        });
    } catch (error) {
        logger.error('Get MFA status error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred',
        });
    }
};

/**
 * Regenerate backup codes
 * POST /api/v1/mfa/regenerate-backup
 */
export const regenerateBackupCodes = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const validation = verifySetupSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        const { code } = validation.data;

        const user = await prisma.user.findUnique({
            where: { userId },
            select: { mfaSecret: true, mfaEnabled: true },
        });

        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            return res.status(400).json({
                success: false,
                message: 'MFA is not enabled.',
            });
        }

        // Verify TOTP code
        if (!verifyTOTPCode(code, user.mfaSecret)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code.',
            });
        }

        // Generate new backup codes using the service
        const { generateBackupCodes, hashBackupCodes } = await import('../../services/mfa.service.js');
        const newCodes = generateBackupCodes(10);
        const hashedCodes = hashBackupCodes(newCodes);

        await prisma.user.update({
            where: { userId },
            data: { mfaBackupCodes: hashedCodes },
        });

        // Format codes for display (4-4-2 pattern for 10 char codes)
        const formattedCodes = newCodes.map(c => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`);

        logger.info('Backup codes regenerated', { userId, count: newCodes.length });

        // Get device info for notification
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        // Send in-app notification
        await inngest.send({
            name: 'notification/send',
            data: {
                userId,
                title: 'Backup Codes Regenerated',
                message: 'Your MFA backup codes have been regenerated',
                description: `You now have ${newCodes.length} new backup codes. All previous codes have been invalidated.`,
                actionUrl: '/dashboard/account-settings',
                actionLabel: 'View Security Settings',
                metadata: {
                    type: 'security',
                    action: 'backup_codes_regenerated',
                    codeCount: newCodes.length,
                    ipAddress,
                    userAgent: userAgent?.substring(0, 200),
                },
            },
        });

        // Send email notification
        await inngest.send({
            name: 'email/backup-codes-regenerated',
            data: {
                userId,
                codeCount: newCodes.length,
                ipAddress,
                userAgent,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'New backup codes generated successfully. Save them in a secure location.',
            data: {
                backupCodes: formattedCodes,
            },
        });
    } catch (error) {
        logger.error('Regenerate backup codes error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred',
        });
    }
};
