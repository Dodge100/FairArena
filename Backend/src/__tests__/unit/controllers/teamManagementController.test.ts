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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import {
  getTeamDetails,
  listOrganizationTeams,
  updateTeam,
} from '../../../controllers/v1/team/teamManagementController.js';
import { inngest } from '../../../inngest/v1/client.js';

vi.mock('../../../config/database.js', () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock('../../../inngest/v1/client.js', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['event_123'] }),
  },
}));

describe('Team Management Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('updateTeam', () => {
    it('returns 202 and sends event to inngest', async () => {
      req = {
        params: { organizationSlug: 'org1', teamSlug: 'team1' },
        user: { userId: 'u1' } as any,
        body: { name: 'New Name' },
        teamContext: {
          teamId: 't1',
          organizationId: 'o1',
          permissions: { team: { edit: true } },
        } as any,
      };

      (prisma.team.findFirst as any).mockResolvedValue(null);

      await updateTeam(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'team/update',
          data: expect.objectContaining({ teamId: 't1', updateData: { name: 'New Name' } }),
        }),
      );
    });

    it('returns 403 if user lacks permission', async () => {
      req = {
        params: { organizationSlug: 'org1', teamSlug: 'team1' },
        user: { userId: 'u1' } as any,
        body: { name: 'New Name' },
        teamContext: { teamId: 't1', permissions: { team: { edit: false } } } as any,
      };

      await updateTeam(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getTeamDetails', () => {
    it('returns team details successfully', async () => {
      req = {
        user: { userId: 'u1' } as any,
        teamContext: { teamId: 't1' } as any,
      };

      const mockTeam = {
        id: 't1',
        name: 'Team 1',
        slug: 'team1',
        _count: { teamMemberships: 5, projects: 2, teamRoles: 3 },
      };

      (prisma.team.findUnique as any).mockResolvedValue(mockTeam);

      await getTeamDetails(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          team: expect.objectContaining({ id: 't1', name: 'Team 1' }),
        }),
      );
    });
  });

  describe('listOrganizationTeams', () => {
    it('returns cached teams if available', async () => {
      req = {
        params: { organizationSlug: 'org1' },
        user: { userId: 'u1' } as any,
      };

      const cachedResponse = { teams: [{ id: 't1', name: 'Cached Team' }] };
      (redis.get as any).mockResolvedValue(cachedResponse);

      await listOrganizationTeams(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedResponse);
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });

    it('fetches from DB and caches if not in cache', async () => {
      req = {
        params: { organizationSlug: 'org1' },
        user: { userId: 'u1' } as any,
        organizationId: 'o1',
      };

      (redis.get as any).mockResolvedValue(null);
      (prisma.team.findMany as any).mockResolvedValue([
        {
          id: 't1',
          name: 'DB Team',
          teamProfile: { description: 'desc' },
          _count: { teamMemberships: 1, projects: 0 },
        },
      ]);

      await listOrganizationTeams(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(redis.setex).toHaveBeenCalled();
      expect(prisma.team.findMany).toHaveBeenCalled();
    });
  });
});
