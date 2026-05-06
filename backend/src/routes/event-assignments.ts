import express from 'express';
import { requireAuth, requireAdmin, requirePermission, Permission } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getEventAssignments,
  assignStudent,
  bulkAssignStudents,
  removeAssignment,
  clearAssignments,
  getUnassignedStudents,
} from '../controllers/event-assignments';

const router = express.Router();

// Validation schemas
const assignStudentSchema = z.object({
  body: z.object({
    studentId: z.string().uuid('Invalid student ID'),
  }),
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

const bulkAssignSchema = z.object({
  body: z.object({
    mode: z.enum(['all', 'campus', 'cohort']),
    campus: z.enum(['NYC', 'Shanghai']).optional(),
    cohort: z.string().optional(),
  }),
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

const eventIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
  }),
});

const removeAssignmentSchema = z.object({
  params: z.object({
    eventId: z.string().uuid('Invalid event ID'),
    studentId: z.string().uuid('Invalid student ID'),
  }),
});

// All routes require authentication
router.use(requireAuth);

// GET /api/events/:eventId/assignments - Get assigned students
router.get(
  '/:eventId/assignments',
  validate(eventIdSchema),
  asyncHandler(getEventAssignments)
);

// GET /api/events/:eventId/unassigned - Get unassigned students
router.get(
  '/:eventId/unassigned',
  validate(eventIdSchema),
  asyncHandler(getUnassignedStudents)
);

// POST /api/events/:eventId/assignments - Assign single student (GEO and Admin)
router.post(
  '/:eventId/assignments',
  requirePermission(Permission.ASSIGN_STUDENTS),
  validate(assignStudentSchema),
  asyncHandler(assignStudent)
);

// POST /api/events/:eventId/assignments/bulk - Bulk assign students (Admin only)
router.post(
  '/:eventId/assignments/bulk',
  requireAdmin,
  validate(bulkAssignSchema),
  asyncHandler(bulkAssignStudents)
);

// DELETE /api/events/:eventId/assignments/:studentId - Remove assignment (Admin only)
router.delete(
  '/:eventId/assignments/:studentId',
  requireAdmin,
  validate(removeAssignmentSchema),
  asyncHandler(removeAssignment)
);

// DELETE /api/events/:eventId/assignments - Clear all assignments (Admin only)
router.delete(
  '/:eventId/assignments',
  requireAdmin,
  validate(eventIdSchema),
  asyncHandler(clearAssignments)
);

export default router;

