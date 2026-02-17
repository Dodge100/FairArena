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
