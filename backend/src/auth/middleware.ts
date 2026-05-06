import { Request, Response, NextFunction } from 'express';
import { Staff } from '../models/Staff';

// Extend Express Request to include user
/* eslint-disable @typescript-eslint/no-namespace -- standard Express + Passport module augmentation */
declare global {
  namespace Express {
    interface User extends Staff {}
    interface Request {
      user?: Staff;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Authentication middleware - requires user to be logged in
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // If not authenticated, return 401
  res.status(401).json({
    error: 'Unauthorized',
    message: 'You must be logged in to access this resource',
  });
};

// Optional auth - attaches user if available but doesn't require it
export const optionalAuth = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // This allows routes to work with or without auth
  // The route handler can check req.user
  next();
};

// Get current user from request
export const getCurrentUser = (req: Request): Staff | null => {
  return req.user || null;
};

