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

import { Router } from 'express';
import { getHackathons } from '../../controllers/v1/hackathonController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/hackathon:
 *   get:
 *     summary: Get list of hackathons
 *     description: Retrieve a list of upcoming and past hackathons.
 *     tags: [Hackathons]
 *     responses:
 *       200:
 *         description: List of hackathons retrieved successfully
 */
router.get('/', getHackathons);

export default router;
