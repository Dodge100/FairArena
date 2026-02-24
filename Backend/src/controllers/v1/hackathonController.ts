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

import type { Request, Response } from 'express';
import { HackathonService } from '../../services/v1/hackathon.service.js';
import logger from '../../utils/logger.js';

export async function getHackathons(_req: Request, res: Response) {
  try {
    const hackathons = await HackathonService.getAllHackathons();

    return res.status(200).json({
      success: true,
      data: hackathons,
    });
  } catch (error) {
    logger.error('Error in getHackathons controller', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hackathons',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
