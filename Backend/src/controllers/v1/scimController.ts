import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import logger from '../../utils/logger.js';

// SCIM Constants
const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

// Helper to format User to SCIM
const toScimUser = (user: any) => ({
  schemas: [SCIM_USER_SCHEMA],
  id: user.userId,
  userName: user.email,
  name: {
    givenName: user.firstName || '',
    familyName: user.lastName || '',
    formatted: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  },
  emails: [{ value: user.email, primary: true, type: 'work' }],
  active: !user.isBanned && !user.isDeleted,
  meta: {
    resourceType: 'User',
    created: user.createdAt.toISOString(),
    lastModified: user.updatedAt.toISOString(),
    location: `${ENV.BASE_URL}/api/v1/scim/v2/Users/${user.userId}`,
  },
});

/**
 * List/Search Users
 * GET /scim/v2/Users
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { startIndex = 1, count = 100, filter } = req.query;
    const skip = Math.max(0, Number(startIndex) - 1);
    const take = Math.min(1000, Number(count));

    let where: any = { isDeleted: false }; // Default only active users? SCIM might want all.

    // Very basic filter parsing for "userName eq '...'"
    if (filter && typeof filter === 'string') {
      const emailMatch = filter.match(/userName eq ["']([^"']+)["']/i);
      if (emailMatch) {
        where.email = emailMatch[1];
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.set('Content-Type', 'application/scim+json').json({
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: total,
      itemsPerPage: users.length,
      startIndex: Number(startIndex),
      Resources: users.map(toScimUser),
    });
  } catch (error: any) {
    logger.error('SCIM getUsers error', { error: error.message });
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};

/**
 * Get User by ID
 * GET /scim/v2/Users/:id
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res.status(404).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '404',
        detail: 'Resource not found',
      });
    }

    res.set('Content-Type', 'application/scim+json').json(toScimUser(user));
  } catch (error: any) {
    logger.error('SCIM getUser error', { error: error.message });
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};

/**
 * Create User
 * POST /scim/v2/Users
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { userName, name, active, emails } = req.body;

    if (!userName) {
      return res.status(400).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '400',
        detail: 'userName is required',
      });
    }

    // Check availability
    const existing = await prisma.user.findUnique({ where: { email: userName } });
    if (existing) {
      return res.status(409).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '409',
        detail: 'User already exists',
      });
    }

    const { createId } = await import('@paralleldrive/cuid2');
    const userId = createId();

    const user = await prisma.user.create({
      data: {
        userId,
        email: userName,
        firstName: name?.givenName,
        lastName: name?.familyName,
        emailVerified: true, // Trusted from SCIM
        // TODO: Link to Organization if provided in headers or context
      },
    });

    res.status(201).set('Content-Type', 'application/scim+json').json(toScimUser(user));
  } catch (error: any) {
    logger.error('SCIM createUser error', { error: error.message });
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};

/**
 * Replace User (PUT)
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { name, active } = req.body;

    const user = await prisma.user.update({
      where: { userId },
      data: {
        firstName: name?.givenName,
        lastName: name?.familyName,
        isBanned: active === false, // Mapping active=false to banned for now
      },
    });

    res.set('Content-Type', 'application/scim+json').json(toScimUser(user));
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '404',
        detail: 'Resource not found',
      });
    }
    logger.error('SCIM updateUser error', { error: error.message });
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};

/**
 * Patch User
 * PATCH /scim/v2/Users/:id
 */
export const patchUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { Operations } = req.body; // Array of operations

    // Very basic implementation: handle 'replace' on 'active'
    let updateData: any = {};

    for (const op of Operations) {
      if (op.op.toLowerCase() === 'replace') {
        if (op.path === 'active') {
          updateData.isBanned = op.value === false;
        }
        if (op.path === 'name.givenName') {
          updateData.firstName = op.value;
        }
        if (op.path === 'name.familyName') {
          updateData.lastName = op.value;
        }
        // Handle raw value object (no path)
        if (!op.path && typeof op.value === 'object') {
          if (op.value.active !== undefined) updateData.isBanned = op.value.active === false;
        }
      }
    }

    const user = await prisma.user.update({
      where: { userId },
      data: updateData,
    });

    res.set('Content-Type', 'application/scim+json').json(toScimUser(user));
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '404',
        detail: 'Resource not found',
      });
    }
    logger.error('SCIM patchUser error', { error: error.message });
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};

/**
 * Delete User
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    await prisma.user.delete({ where: { userId } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        schemas: [SCIM_ERROR_SCHEMA],
        status: '404',
        detail: 'Resource not found',
      });
    }
    res.status(500).json({
      schemas: [SCIM_ERROR_SCHEMA],
      status: '500',
      detail: 'Internal Server Error',
    });
  }
};
