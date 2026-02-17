import { NextFunction, Request, Response } from 'express';
import { Verifier } from '../utils/settings-token-verfier.js';

export const requireSettingsVerification = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    Verifier(req, res, req.user);
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Verification required. Please verify your identity first.',
      code: 'VERIFICATION_REQUIRED',
    });
  }
};
