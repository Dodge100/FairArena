import type { NextFunction, Request, Response } from 'express';
import fetch from 'node-fetch';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';

// Middleware to verify Google reCAPTCHA v2 token
export async function verifyRecaptcha(req: Request, res: Response, next: NextFunction) {
  try {
    const token =
      (req.headers['x-recaptcha-token'] as string) || (req.body?.recaptchaToken as string);
    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing CAPTCHA token' });
    }

    if (!ENV.GOOGLE_RECAPTCHA_SECRET) {
      logger.warn('GOOGLE_RECAPTCHA_SECRET not configured, skipping CAPTCHA verification');
      return next();
    }

    const params = new URLSearchParams();
    params.append('secret', ENV.GOOGLE_RECAPTCHA_SECRET);
    params.append('response', token);
    if (req.ip) params.append('remoteip', req.ip);

    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await resp.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      hostname?: string;
      'error-codes'?: string[];
    };

    if (!data.success) {
      logger.warn('CAPTCHA verification failed', { errors: data['error-codes'] });
      return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
    }

    // Attach verification result to request for downstream usage
    (req as any).recaptchaVerified = true;
    next();
  } catch (error) {
    logger.error('CAPTCHA verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'CAPTCHA verification error' });
  }
}
