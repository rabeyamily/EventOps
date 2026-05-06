import express from 'express';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  generateDailySummary,
  generateStudentAttentionAlerts,
  getPreferences,
  updatePreferences,
} from '../controllers/notifications';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/notifications - Get notifications for current user
router.get(
  '/',
  validate(z.object({
    query: z.object({
      unreadOnly: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }).optional(),
  })),
  asyncHandler(getNotifications)
);

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', asyncHandler(getPreferences));

// PUT /api/notifications/preferences - Update notification preferences
router.put(
  '/preferences',
  validate(z.object({
    body: z.object({
      strikeAlerts: z.boolean().optional(),
      eventReminders: z.boolean().optional(),
      dailySummary: z.boolean().optional(),
      attendanceAlerts: z.boolean().optional(),
    }),
  })),
  asyncHandler(updatePreferences)
);

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', asyncHandler(markAllAsRead));

// POST /api/notifications/daily-summary - Generate daily summary (admin only)
router.post('/daily-summary', requireAdmin, asyncHandler(generateDailySummary));

// POST /api/notifications/student-alerts - Generate student attention alerts (admin only)
router.post('/student-alerts', requireAdmin, asyncHandler(generateStudentAttentionAlerts));

// PATCH /api/notifications/:notificationId/read - Mark single as read
router.patch(
  '/:notificationId/read',
  validate(z.object({ params: z.object({ notificationId: z.string().uuid() }) })),
  asyncHandler(markAsRead)
);

// DELETE /api/notifications/:notificationId - Delete notification
router.delete(
  '/:notificationId',
  validate(z.object({ params: z.object({ notificationId: z.string().uuid() }) })),
  asyncHandler(deleteNotification)
);

export default router;

