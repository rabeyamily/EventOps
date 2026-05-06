import { Router } from 'express';
import { getCurrentSemester, updateCurrentSemester, getAllSettings, getAvailableSemesters, addAvailableSemester } from '../controllers/system-settings';
import { requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// GET /api/system-settings/current-semester - Get current active semester
router.get(
  '/current-semester',
  asyncHandler(getCurrentSemester)
);

// GET /api/system-settings/available-semesters - Get admin-managed list of semesters
router.get(
  '/available-semesters',
  asyncHandler(getAvailableSemesters)
);

// POST /api/system-settings/available-semesters - Add a semester to the list (Admin only)
router.post(
  '/available-semesters',
  requireAdmin,
  validate(z.object({
    body: z.object({
      semester: z.enum(['Spring', 'Fall']),
      academicYear: z.number().int().min(2000).max(2100),
    }),
  })),
  asyncHandler(addAvailableSemester)
);

// PUT /api/system-settings/current-semester - Update current active semester (Admin only)
router.put(
  '/current-semester',
  requireAdmin,
  validate(z.object({
    body: z.object({
      semester: z.enum(['Spring', 'Fall']),
      academicYear: z.number().int().min(2000).max(2100),
    }),
  })),
  asyncHandler(updateCurrentSemester)
);

// GET /api/system-settings - Get all system settings (Admin only)
router.get(
  '/',
  requireAdmin,
  asyncHandler(getAllSettings)
);

export default router;
