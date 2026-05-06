import express from 'express';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  lockEvent,
  unlockEvent,
  getCalendarEvents,
  getUpcomingEvents,
  markDeparted,
} from '../controllers/events';
import {
  importEventsFromCSV,
  importCSVMiddleware,
} from '../controllers/events-import';

const router = express.Router();

// Validation schemas
const createEventSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Event name is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    leadOrganizerId: z.string().uuid('Invalid lead organizer ID'),
    leadOrganizer2Id: z.string().uuid().optional().nullable(),
    leadOrganizer3Id: z.string().uuid().optional().nullable(),
    leadOrganizerIds: z.array(z.string().uuid()).optional(),
    assignedGeoIds: z.array(z.string().uuid()).optional(),
    attendanceMode: z.enum(['bus_based']).optional(),
    notes: z.string().optional(),
  }),
});

const updateEventSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    leadOrganizerId: z.string().uuid().optional(),
    leadOrganizer2Id: z.string().uuid().optional().nullable(),
    leadOrganizer3Id: z.string().uuid().optional().nullable(),
    leadOrganizerIds: z.array(z.string().uuid()).optional(),
    assignedGeoIds: z.array(z.string().uuid()).optional(),
    attendanceMode: z.enum(['bus_based']).optional(),
    notes: z.string().optional(),
    isLocked: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
});

const querySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    attendanceMode: z.enum(['bus_based']).optional(),
    isLocked: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    upcoming: z.string().optional(),
    past: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const calendarQuerySchema = z.object({
  query: z.object({
    year: z.string().min(4, 'Year is required'),
    month: z.string().min(1, 'Month is required'),
  }),
});

// All routes require authentication
router.use(requireAuth);

// GET /api/events - List all events with pagination and filters
router.get('/', validate(querySchema), asyncHandler(getEvents));

// GET /api/events/calendar - Get events for calendar view
router.get('/calendar', validate(calendarQuerySchema), asyncHandler(getCalendarEvents));

// GET /api/events/upcoming - Get upcoming events (dashboard)
router.get('/upcoming', asyncHandler(getUpcomingEvents));

// GET /api/events/:id - Get event by ID
router.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(getEventById)
);

// POST /api/events - Create new event (Admin only)
router.post(
  '/',
  requireAdmin,
  validate(createEventSchema),
  asyncHandler(createEvent)
);

// PUT /api/events/:id - Update event (Admin only)
router.put(
  '/:id',
  requireAdmin,
  validate(updateEventSchema),
  asyncHandler(updateEvent)
);

// DELETE /api/events/:id - Delete event (Admin only)
router.delete(
  '/:id',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(deleteEvent)
);

// POST /api/events/:id/lock - Lock event
router.post(
  '/:id/lock',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(lockEvent)
);

// POST /api/events/:id/unlock - Unlock event (Admin only)
router.post(
  '/:id/unlock',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(unlockEvent)
);

// POST /api/events/:id/depart - Mark event as departed
router.post(
  '/:id/depart',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(markDeparted)
);

// POST /api/events/import - Import events from CSV (Admin only)
router.post(
  '/import',
  requireAdmin,
  importCSVMiddleware,
  asyncHandler(importEventsFromCSV)
);


export default router;
