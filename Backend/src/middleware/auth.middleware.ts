import { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      auth: () => {
        userId?: string;
        isAuthenticated?: boolean;
      };
    }
  }
}

export const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = await req.auth();
    if (!auth?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - you must be logged in',
      });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};
