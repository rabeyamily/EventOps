import express from 'express';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getStudentStrikes,
  createStrike,
  excuseStrike,
  reinstateStrike,
  deleteStrike,
  processEventStrikes,
  getStudentsAtRisk,
} from '../controllers/strikes';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/strikes/at-risk - Get students at risk (1+ strikes)
router.get(
  '/at-risk',
  asyncHandler(getStudentsAtRisk)
);

// GET /api/strikes/student/:studentId - Get strikes for a student
router.get(
  '/student/:studentId',
  validate(z.object({
    params: z.object({ studentId: z.string().uuid() }),
    query: z.object({ includeExcused: z.string().optional() }).optional(),
  })),
  asyncHandler(getStudentStrikes)
);

// POST /api/strikes - Create a strike manually (admin only)
router.post(
  '/',
  requireAdmin,
  validate(z.object({
    body: z.object({
      studentId: z.string().uuid(),
      eventId: z.string().uuid(),
      reason: z.string().optional(),
    }),
  })),
  asyncHandler(createStrike)
);

// POST /api/strikes/event/:eventId/process - Process strikes for an event (admin only)
router.post(
  '/event/:eventId/process',
  requireAdmin,
  validate(z.object({
    params: z.object({ eventId: z.string().uuid() }),
  })),
  asyncHandler(processEventStrikes)
);

// PATCH /api/strikes/:strikeId/excuse - Excuse a strike (admin only)
router.patch(
  '/:strikeId/excuse',
  requireAdmin,
  validate(z.object({
    params: z.object({ strikeId: z.string().uuid() }),
    body: z.object({ reason: z.string().optional() }),
  })),
  asyncHandler(excuseStrike)
);

// PATCH /api/strikes/:strikeId/reinstate - Reinstate a strike (admin only)
router.patch(
  '/:strikeId/reinstate',
  requireAdmin,
  validate(z.object({
    params: z.object({ strikeId: z.string().uuid() }),
  })),
  asyncHandler(reinstateStrike)
);

// DELETE /api/strikes/:strikeId - Delete a strike (admin only)
router.delete(
  '/:strikeId',
  requireAdmin,
  validate(z.object({
    params: z.object({ strikeId: z.string().uuid() }),
  })),
  asyncHandler(deleteStrike)
);

export default router;
