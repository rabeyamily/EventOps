import { Request, Response, NextFunction } from 'express';
import { StaffRole } from '../models/Staff';
import { requireAuth, getCurrentUser } from './middleware';

// Re-export requireAuth so it can be imported from this file
export { requireAuth };

// Permission types
export enum Permission {
  // Student permissions
  VIEW_STUDENTS = 'view_students',
  CREATE_STUDENT = 'create_student',
  UPDATE_STUDENT = 'update_student',
  DELETE_STUDENT = 'delete_student',
  
  // Event permissions
  VIEW_EVENTS = 'view_events',
  CREATE_EVENT = 'create_event',
  UPDATE_EVENT = 'update_event',
  DELETE_EVENT = 'delete_event',
  LOCK_EVENT = 'lock_event',
  
  // Attendance permissions
  VIEW_ATTENDANCE = 'view_attendance',
  MARK_ATTENDANCE = 'mark_attendance',
  UPDATE_ATTENDANCE = 'update_attendance',
  
  // Strike permissions
  VIEW_STRIKES = 'view_strikes',
  EXCUSE_STRIKE = 'excuse_strike',
  REMOVE_STRIKE = 'remove_strike',
  
  // Staff permissions
  VIEW_STAFF = 'view_staff',
  CREATE_STAFF = 'create_staff',
  UPDATE_STAFF = 'update_staff',
  DELETE_STAFF = 'delete_staff',
  
  // Assignment permissions
  ASSIGN_STUDENTS = 'assign_students',
  UNASSIGN_STUDENTS = 'unassign_students',
  
  // Bus permissions
  MARK_DEPARTURE = 'mark_departure',
  
  // Admin permissions
  EXPORT_DATA = 'export_data',
}

// Role-based permissions mapping
const rolePermissions: Record<StaffRole, Permission[]> = {
  [StaffRole.STAFF]: [
    Permission.VIEW_STUDENTS,
    Permission.VIEW_EVENTS,
    Permission.VIEW_ATTENDANCE,
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_STRIKES,
    Permission.VIEW_STAFF,
    Permission.ASSIGN_STUDENTS,
    Permission.UNASSIGN_STUDENTS,
  ],
  [StaffRole.ADMIN]: [
    // Admins have all permissions
    ...Object.values(Permission),
  ],
};

// Check if a role has a specific permission
export const hasPermission = (role: StaffRole, permission: Permission): boolean => {
  const permissions = rolePermissions[role] || [];
  return permissions.includes(permission);
};

// Check if current user has permission
export const userHasPermission = (req: Request, permission: Permission): boolean => {
  const user = getCurrentUser(req);
  if (!user) return false;
  return hasPermission(user.role, permission);
};

// Middleware to require a specific permission
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    if (!hasPermission(user.role, permission)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `You do not have permission to ${permission}`,
      });
      return;
    }

    next();
  };
};

// Middleware to require admin role
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  requireAuth(req, res, () => {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    if (user.role !== StaffRole.ADMIN) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'This action requires admin privileges',
      });
      return;
    }

    next();
  });
};

// Middleware to require staff role (staff or admin)
export const requireStaff = (req: Request, res: Response, next: NextFunction): void => {
  requireAuth(req, res, () => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Both staff and admin can access
    if (user.role === StaffRole.STAFF || user.role === StaffRole.ADMIN) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires staff privileges',
    });
  });
};

// Helper to get user role
export const getUserRole = (req: Request): StaffRole | null => {
  const user = getCurrentUser(req);
  return user?.role || null;
};

// Helper to check if user is admin
export const isAdmin = (req: Request): boolean => {
  const user = getCurrentUser(req);
  return user?.role === StaffRole.ADMIN || false;
};

