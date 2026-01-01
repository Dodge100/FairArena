import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { inngest } from '../../inngest/v1/client.js';
import logger from '../../utils/logger.js';

// Validation schemas
const joinWaitlistSchema = z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().max(100).optional(),
    source: z.string().max(50).optional(),
});

/**
 * Join the waitlist
 * POST /api/v1/waitlist
 */
export const joinWaitlist = async (req: Request, res: Response) => {
    try {
        const validation = joinWaitlistSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.error.flatten().fieldErrors,
            });
        }

        if (ENV.NEW_SIGNUP_ENABLED) {
            return res.status(403).json({
                success: false,
                message: 'Waitlist is closed. Please sign up directly.',
                code: 'WAITLIST_DISABLED',
            });
        }

        const { email, name, source } = validation.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists in waitlist
        const existing = await prisma.waitlist.findUnique({
            where: { email: normalizedEmail },
        });

        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'You are already on the waitlist!',
                data: {
                    position: await getWaitlistPosition(existing.id),
                    status: existing.status,
                },
            });
        }

        // Check if user already has an account
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { userId: true },
        });

        if (existingUser) {
            return res.status(200).json({
                success: true,
                message: 'You already have an account! Please sign in.',
                data: {
                    hasAccount: true,
                },
            });
        }

        // Create waitlist entry
        const waitlistEntry = await prisma.waitlist.create({
            data: {
                email: normalizedEmail,
                name,
                source: source || 'website',
            },
        });

        // Get position in waitlist
        const position = await getWaitlistPosition(waitlistEntry.id);

        // Send confirmation email via Inngest
        await inngest.send({
            name: 'email.send',
            data: {
                to: normalizedEmail,
                subject: 'Welcome to the FairArena Waitlist!',
                template: 'waitlist-confirmation',
                templateData: {
                    name: name || 'there',
                    position,
                },
            },
        });

        logger.info('User joined waitlist', { email: normalizedEmail, position });

        return res.status(201).json({
            success: true,
            message: 'Successfully joined the waitlist!',
            data: {
                position,
                email: normalizedEmail,
            },
        });
    } catch (error) {
        logger.error('Join waitlist error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred while joining the waitlist',
        });
    }
};

/**
 * Check waitlist status
 * GET /api/v1/waitlist/status/:email
 */
export const checkWaitlistStatus = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        const normalizedEmail = email.toLowerCase().trim();

        const entry = await prisma.waitlist.findUnique({
            where: { email: normalizedEmail },
        });

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Email not found in waitlist',
            });
        }

        const position = await getWaitlistPosition(entry.id);

        return res.status(200).json({
            success: true,
            data: {
                email: entry.email,
                status: entry.status,
                position,
                joinedAt: entry.createdAt,
            },
        });
    } catch (error) {
        logger.error('Check waitlist status error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred',
        });
    }
};

/**
 * Get waitlist stats (public)
 * GET /api/v1/waitlist/stats
 */
export const getWaitlistStats = async (_req: Request, res: Response) => {
    try {
        const totalCount = await prisma.waitlist.count();
        const pendingCount = await prisma.waitlist.count({
            where: { status: 'PENDING' },
        });

        return res.status(200).json({
            success: true,
            data: {
                total: totalCount,
                pending: pendingCount,
            },
        });
    } catch (error) {
        logger.error('Get waitlist stats error', {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred',
        });
    }
};

// Helper function to get position in waitlist
async function getWaitlistPosition(id: string): Promise<number> {
    const position = await prisma.waitlist.count({
        where: {
            status: 'PENDING',
            createdAt: {
                lte: (await prisma.waitlist.findUnique({ where: { id } }))?.createdAt,
            },
        },
    });
    return position;
}
