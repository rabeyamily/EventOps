import express from 'express';
import { requireAuth, requireAdmin, requireStaff } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { getAdminDashboard, getLiveEventDashboard, getRiskDashboard, getSemesterReport, getEventSummary } from '../controllers/dashboard';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/dashboard/admin - Get shared dashboard for staff/admin
router.get('/admin', requireStaff, asyncHandler(getAdminDashboard));

// GET /api/dashboard/risk - Get risk dashboard
router.get('/risk', asyncHandler(getRiskDashboard));

// GET /api/dashboard/semester-report - Get semester overall report (admin only)
router.get(
  '/semester-report',
  requireAdmin,
  validate(z.object({
    query: z.object({
      semester: z.string().optional(),
    }).optional(),
  })),
  asyncHandler(getSemesterReport)
);

// GET /api/dashboard/event-summary/:eventId - Get post-event summary
router.get(
  '/event-summary/:eventId',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getEventSummary)
);

// GET /api/dashboard/event/:eventId - Get live event dashboard
router.get(
  '/event/:eventId',
  validate(z.object({ params: z.object({ eventId: z.string().uuid() }) })),
  asyncHandler(getLiveEventDashboard)
);

export default router;

