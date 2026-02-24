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

import express from 'express';
import { getLastUpdated } from '../../controllers/v1/githubController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/github/last-updated:
 *   get:
 *     summary: Get last updated date from GitHub repository
 *     description: Retrieve the timestamp of the last update to the specified GitHub repository.
 *     tags: [GitHub]
 *     responses:
 *       200:
 *         description: Last updated timestamp retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 */
router.get('/last-updated', getLastUpdated);

export default router;
