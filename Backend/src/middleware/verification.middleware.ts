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
