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
