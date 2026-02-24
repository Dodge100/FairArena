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

import type { NextFunction, Request, Response } from 'express';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';

// Middleware to check maintenance mode
export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow health check and metrics endpoints even during maintenance
  if (req.path === '/healthz' || req.path === '/metrics') {
    return next();
  }

  // Check if maintenance mode is enabled
  if (ENV.MAINTENANCE_MODE === true) {
    logger.info('Request blocked due to maintenance mode', { path: req.path, ip: req.ip });
    return res.status(503).json({
      success: false,
      message: 'Site is currently under maintenance. Please try again later.',
      maintenanceMode: true,
    });
  }

  next();
}
