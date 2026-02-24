/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Request, Response } from 'express';
import { prisma } from '../../../config/database.js';
import { inngest } from '../../../inngest/v1/client.js';
import logger from '../../../utils/logger.js';

/**
 * Get invitation details by code (public endpoint - no auth required)
 */
export const getInvitationDetails = async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.params;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Find the invitation
    const invitation = await prisma.inviteCode.findUnique({
      where: { code: inviteCode as string },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        role: {
          select: {
            roleName: true,
            permissions: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation code' });
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return res.status(410).json({ error: 'This invitation has expired' });
    }

    // Check if already used
    if (invitation.used) {
      return res.status(410).json({ error: 'This invitation has already been used' });
    }

    res.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        organizationName: (invitation as any).team.organization.name,
        organizationSlug: (invitation as any).team.organization.slug,
        teamName: (invitation as any).team.name,
        teamSlug: (invitation as any).team.slug,
        roleName: (invitation as any).role.roleName,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching invitation details', {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Accept team invitation
 */
export const acceptTeamInvitation = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { inviteCode } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'You must be logged in to accept an invitation' });
    }

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { id: true, userId: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the invitation
    const invitation = await prisma.inviteCode.findUnique({
      where: { code: inviteCode as string },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        role: {
          select: {
            id: true,
            roleName: true,
            permissions: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation code' });
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return res.status(410).json({ error: 'This invitation has expired' });
    }

    // Check if already used
    if (invitation.used) {
      return res.status(410).json({ error: 'This invitation has already been used' });
    }

    // Verify email matches (case insensitive)
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        error: 'This invitation was sent to a different email address',
        invitedEmail: invitation.email,
        yourEmail: user.email,
      });
    }

    // Check if user is already a member of this team
    const existingMembership = await prisma.userTeam.findFirst({
      where: {
        userId: user.userId,
        teamId: (invitation as any).team.id,
      },
    });

    if (existingMembership) {
      // Mark invitation as used anyway
      await prisma.inviteCode.update({
        where: { id: invitation.id },
        data: { used: true },
      });

      return res.status(400).json({
        error: 'You are already a member of this team',
        teamSlug: (invitation as any).team.slug,
        organizationSlug: (invitation as any).team.organization.slug,
      });
    }

    // Process acceptance asynchronously via Inngest
    await inngest.send({
      name: 'team/invite.accept',
      data: {
        inviteId: invitation.id,
        userId: user.userId,
        userEmail: user.email,
      },
    });

    logger.info('Team invitation acceptance queued', {
      inviteId: invitation.id,
      userId: user.userId,
      teamId: (invitation as any).team.id,
    });

    res.status(202).json({
      message: 'Your request to join the team is being processed',
      team: {
        id: (invitation as any).team.id,
        name: (invitation as any).team.name,
        slug: (invitation as any).team.slug,
        organizationSlug: (invitation as any).team.organization.slug,
        roleName: (invitation as any).role.roleName,
      },
      redirectUrl: `/organization/${(invitation as any).team.organization.slug}/team/${(invitation as any).team.slug}`,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error accepting team invitation', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Decline team invitation
 */
export const declineTeamInvitation = async (req: Request, res: Response) => {
  try {
    const auth = req.user;
    const userId = auth?.userId;
    const { inviteCode } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'You must be logged in to decline an invitation' });
    }

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the invitation
    const invitation = await prisma.inviteCode.findUnique({
      where: { code: inviteCode as string },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation code' });
    }

    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        error: 'This invitation was sent to a different email address',
      });
    }

    // Check if already used
    if (invitation.used) {
      return res.status(410).json({ error: 'This invitation has already been used' });
    }

    // Delete the invitation (declining means removing it)
    await prisma.inviteCode.delete({
      where: { id: invitation.id },
    });

    // Create audit log
    await inngest.send({
      name: 'team/audit-log.create',
      data: {
        teamId: (invitation as any).team.id,
        userId,
        action: 'INVITATION_DECLINED',
        level: 'INFO',
      },
    });

    logger.info('Team invitation declined', {
      inviteId: invitation.id,
      userId,
      teamId: (invitation as any).team.id,
    });

    res.json({ message: 'Invitation declined successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('Error declining team invitation', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.userId,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
