import { Request, Response } from 'express';
import { Notification, NotificationType } from '../models/Notification';
import { Staff, StaffRole } from '../models/Staff';
import { Student, StudentStatus } from '../models/Student';
import { Event } from '../models/Event';
import { Attendance } from '../models/Attendance';
import { Strike } from '../models/Strike';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPagination } from '../utils/query';
import { Op } from 'sequelize';

// Get notifications for current user
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { page, limit, offset } = getPagination(req);
    const { unreadOnly } = req.query;

    const where: any = { staffId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const unreadCount = await Notification.count({ where: { staffId, isRead: false } });

    sendPaginated(res, rows, { page, limit, total: count }, { unreadCount });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch notifications', 500);
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const staffId = req.user?.id;

    const notification = await Notification.findOne({
      where: { id: notificationId, staffId },
    });

    if (!notification) {
      sendError(res, 'Notification not found', 404);
      return;
    }

    await notification.update({ isRead: true, readAt: new Date() });

    sendSuccess(res, notification);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark notification as read', 500);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { staffId, isRead: false } }
    );

    sendSuccess(res, null, 200, 'All notifications marked as read');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark all as read', 500);
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const staffId = req.user?.id;

    const notification = await Notification.findOne({
      where: { id: notificationId, staffId },
    });

    if (!notification) {
      sendError(res, 'Notification not found', 404);
      return;
    }

    await notification.destroy();

    sendSuccess(res, null, 200, 'Notification deleted');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete notification', 500);
  }
};

// Create notification for all admins
export const notifyAdmins = async (
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const admins = await Staff.findAll({ where: { role: StaffRole.ADMIN } });

    for (const admin of admins) {
      await Notification.create({
        staffId: admin.id,
        type,
        title,
        message,
        data,
      });
    }
  } catch (error) {
    console.error('Failed to create admin notifications:', error);
  }
};

// Create notification for specific staff
export const notifyStaff = async (
  staffId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    await Notification.create({
      staffId,
      type,
      title,
      message,
      data,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// Generate daily summary (called by cron or manually)
export const generateDailySummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's events
    const todaysEvents = await Event.findAll({
      where: {
        startDate: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
    });

    // Get students at risk
    const atRiskStudents = await Student.count({ where: { strikeCount: { [Op.gte]: 1 } } });
    const blockedStudents = await Student.count({ where: { status: StudentStatus.BLOCKED } });

    // Get today's strikes
    const todaysStrikes = await Strike.count({
      where: {
        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow },
        isExcused: false,
      },
    });

    // Create summary notification for all admins
    const title = '📊 Daily Summary';
    const message = `Today: ${todaysEvents.length} events scheduled. ${atRiskStudents} students at risk (${blockedStudents} blocked). ${todaysStrikes} new strikes today.`;

    await notifyAdmins(NotificationType.SYSTEM, title, message, {
      events: todaysEvents.length,
      atRisk: atRiskStudents,
      blocked: blockedStudents,
      newStrikes: todaysStrikes,
    });

    sendSuccess(res, { sent: true }, 200, 'Daily summary sent');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to generate daily summary', 500);
  }
};

// Generate student attention notifications (attendance issues, blocked, missing info)
export const generateStudentAttentionAlerts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const blockedStudents = await Student.findAll({
      where: { status: StudentStatus.BLOCKED },
      attributes: ['id', 'fullName', 'nyuEmail', 'strikeCount'],
    });

    if (blockedStudents.length > 0) {
      await notifyAdmins(
        NotificationType.STRIKE_BLOCKED,
        '🚫 Blocked Students Alert',
        `${blockedStudents.length} student${blockedStudents.length !== 1 ? 's are' : ' is'} currently blocked: ${blockedStudents.slice(0, 3).map(s => s.fullName).join(', ')}${blockedStudents.length > 3 ? ` and ${blockedStudents.length - 3} more` : ''}.`,
        { studentIds: blockedStudents.map(s => s.id), count: blockedStudents.length }
      );
    }

    const atRiskStudents = await Student.findAll({
      where: { strikeCount: 1, status: StudentStatus.ONE_STRIKE },
      attributes: ['id', 'fullName', 'nyuEmail'],
    });

    if (atRiskStudents.length > 0) {
      await notifyAdmins(
        NotificationType.STRIKE_WARNING,
        '⚠️ Students At Risk',
        `${atRiskStudents.length} student${atRiskStudents.length !== 1 ? 's have' : ' has'} 1 strike and ${atRiskStudents.length !== 1 ? 'are' : 'is'} at risk of being blocked.`,
        { studentIds: atRiskStudents.map(s => s.id), count: atRiskStudents.length }
      );
    }

    const missingInfoStudents = await Student.findAll({
      // Sequelize typings reject `[Op.is]: null` on string columns; runtime query is valid.
      where: {
        [Op.or]: [
          { uaePhone: { [Op.is]: null } },
          { uaePhone: '' },
          { emergencyContact: { [Op.is]: null } },
          { emergencyContact: '' },
        ],
      } as any,
      attributes: ['id', 'fullName'],
    });

    if (missingInfoStudents.length > 0) {
      await notifyAdmins(
        NotificationType.ATTENDANCE_ALERT,
        '📝 Missing Student Information',
        `${missingInfoStudents.length} student${missingInfoStudents.length !== 1 ? 's are' : ' is'} missing contact or emergency information.`,
        { studentIds: missingInfoStudents.map(s => s.id), count: missingInfoStudents.length }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysEvents = await Event.findAll({
      where: { startDate: { [Op.gte]: today, [Op.lt]: tomorrow } },
      attributes: ['id', 'name'],
    });

    for (const event of todaysEvents) {
      const notMarkedCount = await Attendance.count({
        where: { eventId: event.id, status: 'not_marked' },
      });
      if (notMarkedCount > 0) {
        await notifyAdmins(
          NotificationType.ATTENDANCE_ALERT,
          `📋 Attendance Incomplete: ${event.name}`,
          `${notMarkedCount} student${notMarkedCount !== 1 ? 's have' : ' has'} not been marked for "${event.name}".`,
          { eventId: event.id, count: notMarkedCount }
        );
      }
    }

    sendSuccess(res, { sent: true }, 200, 'Student attention alerts generated');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to generate student attention alerts', 500);
  }
};

// Get notification preferences for current user
export const getPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // For now, return default preferences
    // In a full implementation, these would be stored per-user
    sendSuccess(res, {
      strikeAlerts: true,
      eventReminders: true,
      dailySummary: true,
      attendanceAlerts: true,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch preferences', 500);
  }
};

// Update notification preferences
export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { strikeAlerts, eventReminders, dailySummary, attendanceAlerts } = req.body;

    // In a full implementation, save these preferences to the database
    sendSuccess(res, {
      strikeAlerts: strikeAlerts ?? true,
      eventReminders: eventReminders ?? true,
      dailySummary: dailySummary ?? true,
      attendanceAlerts: attendanceAlerts ?? true,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update preferences', 500);
  }
};

