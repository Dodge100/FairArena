import { NextFunction, Request, Response } from 'express';
import { aj } from '../config/arcjet.js';
import logger from '../utils/logger.js';

export const arcjetMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/inngest') || req.path.startsWith('/healthz') || req.path.startsWith('/api/v1/payments/webhook')) {
    return next();
  }

  try {
    const decision = await aj.protect(req, { requested: 1 });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        });
      } else if (decision.reason.isBot()) {
        return res.status(403).json({
          error: 'Bot access denied',
          message: 'Automated requests are not allowed.',
        });
      } else {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied by security policy.',
        });
      }
    }

    if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
      return res.status(403).json({
        error: 'Spoofed bot detected',
        message: 'Malicious bot activity detected.',
      });
    }

    next();
  } catch (error) {
    logger.error('Arcjet middleware error:', { error });
    next();
  }
};
