import express from 'express';
import { requireAuth, requireAdmin, requireStaff } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffActivity,
  getCurrentProfile,
  updateCurrentProfile,
} from '../controllers/staff';
import { importStaffFromCSV, importStaffCSVMiddleware } from '../controllers/staff-import';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/staff/me - Get current user profile
router.get('/me', asyncHandler(getCurrentProfile));

// PUT /api/staff/me - Update current user's own profile
router.put(
  '/me',
  validate(z.object({
    body: z.object({
      preferredName: z.string().optional(),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      uaePhone: z.string().optional(),
      nyuEmail: z.string().email().optional(),
      classYear: z.string().optional(),
      major: z.string().optional(),
      minor: z.string().optional(),
      notes: z.string().optional(),
    }),
  })),
  asyncHandler(updateCurrentProfile)
);

// POST /api/staff/import - Import staff / GEO from CSV (admin only)
router.post(
  '/import',
  requireAdmin,
  importStaffCSVMiddleware,
  asyncHandler(importStaffFromCSV)
);

// GET /api/staff - Get all staff (staff and admin)
router.get(
  '/',
  requireStaff,
  validate(z.object({
    query: z.object({
      search: z.string().optional(),
      role: z.enum(['staff', 'admin']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }).optional(),
  })),
  asyncHandler(getAllStaff)
);

// GET /api/staff/:staffId/activity - Get staff activity (MUST be before /:staffId route)
router.get(
  '/:staffId/activity',
  validate(z.object({ params: z.object({ staffId: z.string().uuid() }) })),
  asyncHandler(getStaffActivity)
);

// GET /api/staff/:staffId - Get staff by ID
router.get(
  '/:staffId',
  validate(z.object({ params: z.object({ staffId: z.string().uuid() }) })),
  asyncHandler(getStaffById)
);

// POST /api/staff - Create staff (admin only)
router.post(
  '/',
  requireAdmin,
  validate(z.object({
    body: z.object({
      fullName: z.string().min(1),
      preferredName: z.string().optional(),
      email: z.string().email(),
      nyuEmail: z.string().email().optional(),
      classYear: z.string().optional(),
      major: z.string().optional(),
      role: z.enum(['staff', 'admin']).optional(),
      position: z.string().optional(),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      uaePhone: z.string().optional(),
      password: z.string().min(6).optional(),
    }),
  })),
  asyncHandler(createStaff)
);

// PUT /api/staff/:staffId - Update staff (admin only)
router.put(
  '/:staffId',
  requireAdmin,
  validate(z.object({
    params: z.object({ staffId: z.string().uuid() }),
    body: z.object({
      fullName: z.string().min(1).optional(),
      preferredName: z.string().optional(),
      email: z.string().email().optional(),
      nyuEmail: z.string().email().optional(),
      classYear: z.string().optional(),
      major: z.string().optional(),
      minor: z.string().optional(),
      notes: z.string().optional(),
      role: z.enum(['staff', 'admin']).optional(),
      position: z.string().optional(),
      phone: z.string().optional(),
      whatsapp: z.string().optional(),
      uaePhone: z.string().optional(),
    }),
  })),
  asyncHandler(updateStaff)
);

// DELETE /api/staff/:staffId - Delete staff (admin only)
router.delete(
  '/:staffId',
  requireAdmin,
  validate(z.object({ params: z.object({ staffId: z.string().uuid() }) })),
  asyncHandler(deleteStaff)
);

export default router;

