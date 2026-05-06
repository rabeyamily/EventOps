import express from 'express';
import { requireAuth } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  createAttendanceSheet,
  getEventAttendanceSheets,
  setActiveSheet,
  getActiveSheet,
  addBus,
  deleteBus,
  deleteSheet,
} from '../controllers/attendance-sheets';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// POST /api/attendance-sheets/event/:eventId/add-bus - Add a new bus with default sheets
router.post(
  '/event/:eventId/add-bus',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(addBus)
);

// DELETE /api/attendance-sheets/event/:eventId/bus/:busNumber - Delete a bus and all its sheets
router.delete(
  '/event/:eventId/bus/:busNumber',
  validate(z.object({ params: z.object({ eventId: z.string().uuid(), busNumber: z.string() }) })),
  asyncHandler(deleteBus)
);

// POST /api/attendance-sheets/event/:eventId - Create a new attendance sheet
router.post(
  '/event/:eventId',
  validate(z.object({
    params: z.object({ eventId: z.string().uuid() }),
    body: z.object({
      name: z.string().min(1),
      busNumber: z.string().min(1),
    }),
  })),
  asyncHandler(createAttendanceSheet)
);

// GET /api/attendance-sheets/event/:eventId - Get all attendance sheets for an event
router.get(
  '/event/:eventId',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getEventAttendanceSheets)
);

// GET /api/attendance-sheets/event/:eventId/active - Get active sheet for an event
router.get(
  '/event/:eventId/active',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getActiveSheet)
);

// POST /api/attendance-sheets/:sheetId/activate - Set a sheet as active
router.post(
  '/:sheetId/activate',
  validate(z.object({ params: z.object({ sheetId: z.string().uuid() }) })),
  asyncHandler(setActiveSheet)
);

// DELETE /api/attendance-sheets/:sheetId - Delete a single attendance sheet
router.delete(
  '/:sheetId',
  validate(z.object({ params: z.object({ sheetId: z.string().uuid() }) })),
  asyncHandler(deleteSheet)
);

export default router;
