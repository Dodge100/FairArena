/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 */

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../config/database.js';
import { createTeam } from '../../../controllers/v1/team/createTeamController.js';
import { inngest } from '../../../inngest/v1/client.js';

vi.mock('../../../config/database.js', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    organizationUserRole: {
      findFirst: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../inngest/v1/client.js', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_123'] }),
  },
}));

describe('Create Team Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('successfully triggers team creation via inngest', async () => {
    req = {
      params: { organizationSlug: 'org1' },
      user: { userId: 'u1' } as any,
      body: { name: 'My Team', slug: 'my-team' },
    };

    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'o1', slug: 'org1' });
    (prisma.organizationUserRole.findFirst as any).mockResolvedValue({
      role: { permissions: { teams: { create: true } } },
    });
    (prisma.team.findFirst as any).mockResolvedValue(null);

    await createTeam(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'team/create',
        data: expect.objectContaining({ name: 'My Team', organizationId: 'o1' }),
      }),
    );
  });

  it('returns 403 if user lacks permission to create teams', async () => {
    req = {
      params: { organizationSlug: 'org1' },
      user: { userId: 'u1' } as any,
      body: { name: 'My Team', slug: 'my-team' },
    };

    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'o1', slug: 'org1' });
    (prisma.organizationUserRole.findFirst as any).mockResolvedValue({
      role: { permissions: { teams: { create: false } } },
    });

    await createTeam(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to create teams' });
  });

  it('returns 409 if team with same name/slug exists', async () => {
    req = {
      params: { organizationSlug: 'org1' },
      user: { userId: 'u1' } as any,
      body: { name: 'Existing', slug: 'existing' },
    };

    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'o1', slug: 'org1' });
    (prisma.organizationUserRole.findFirst as any).mockResolvedValue({
      role: { permissions: { teams: { create: true } } },
    });
    (prisma.team.findFirst as any).mockResolvedValue({ id: 't-old', name: 'Existing' });

    await createTeam(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Team with this name already exists' });
  });
});
