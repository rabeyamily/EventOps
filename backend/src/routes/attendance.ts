import express from 'express';
import { requireAuth } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getEventAttendance,
  getEventAttendanceSummary,
  markAttendance,
  bulkMarkAttendance,
  markAllAbsent,
  updateAttendanceNotes,
  getStudentAttendance,
  quickTapAttendance,
  exportEventAttendance,
  exportAttendanceReport,
} from '../controllers/attendance';

const router = express.Router();

// Validation schemas
const markAttendanceSchema = z.object({
  body: z.object({
    status: z.enum(['present', 'absent', 'not_marked']),
    notes: z.string().optional(),
    isHandOffMode: z.boolean().optional(),
  }),
  params: z.object({
    eventId: z.string().uuid(),
    studentId: z.string().uuid(),
  }),
});

const bulkMarkSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string().uuid()),
    status: z.enum(['present', 'absent', 'not_marked']),
    notes: z.string().optional(),
  }),
  params: z.object({
    eventId: z.string().uuid(),
  }),
});

const notesSchema = z.object({
  body: z.object({
    notes: z.string(),
  }),
  params: z.object({
    attendanceId: z.string().uuid(),
  }),
});

// All routes require authentication
router.use(requireAuth);

// GET /api/attendance/event/:eventId - Get all attendance for an event
router.get(
  '/event/:eventId',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getEventAttendance)
);

// GET /api/attendance/event/:eventId/summary - Get attendance summary for an event
router.get(
  '/event/:eventId/summary',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getEventAttendanceSummary)
);

// POST /api/attendance/event/:eventId/student/:studentId - Mark attendance for a student
router.post(
  '/event/:eventId/student/:studentId',
  validate(markAttendanceSchema),
  asyncHandler(markAttendance)
);

// POST /api/attendance/event/:eventId/student/:studentId/tap - Quick tap to toggle attendance
router.post(
  '/event/:eventId/student/:studentId/tap',
  validate(z.object({
    params: z.object({
      eventId: z.string().uuid(),
      studentId: z.string().uuid(),
    }),
    body: z.object({
      isHandOffMode: z.boolean().optional(),
    }).optional(),
  })),
  asyncHandler(quickTapAttendance)
);

// POST /api/attendance/event/:eventId/bulk - Bulk mark attendance
router.post(
  '/event/:eventId/bulk',
  validate(bulkMarkSchema),
  asyncHandler(bulkMarkAttendance)
);

// POST /api/attendance/event/:eventId/mark-all-absent - Mark all unmarked as absent
router.post(
  '/event/:eventId/mark-all-absent',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(markAllAbsent)
);

// PATCH /api/attendance/:attendanceId/notes - Update attendance notes
router.patch(
  '/:attendanceId/notes',
  validate(notesSchema),
  asyncHandler(updateAttendanceNotes)
);

// GET /api/attendance/student/:studentId - Get attendance history for a student
router.get(
  '/student/:studentId',
  validate(z.object({ params: z.object({ studentId: z.string().uuid() }) })),
  asyncHandler(getStudentAttendance)
);

// GET /api/attendance/event/:eventId/export - Export event attendance as CSV
router.get(
  '/event/:eventId/export',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(exportEventAttendance)
);

// GET /api/attendance/export - Export attendance report with date range
router.get(
  '/export',
  validate(z.object({
    query: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional(),
  })),
  asyncHandler(exportAttendanceReport)
);

export default router;
