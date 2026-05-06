import { Request, Response } from 'express';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { AttendanceSheet } from '../models/AttendanceSheet';
import { Event } from '../models/Event';
import { Student } from '../models/Student';
import { Staff } from '../models/Staff';
import { sendSuccess, sendError } from '../utils/response';
import { Op } from 'sequelize';

// Get all attendance records for an event
export const getEventAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { status, sheetId } = req.query;

    // Check if event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Get active sheet if no sheetId specified
    // Only filter by sheet if explicitly requested (for attendance page)
    // Otherwise show all attendance records (for event detail page to show all assigned students)
    let activeSheetId: string | null = null;
    const filterBySheet = req.query.filterBySheet === 'true' || sheetId; // Only filter if explicitly requested
    
    if (filterBySheet) {
      if (sheetId) {
        activeSheetId = sheetId as string;
      } else {
        const activeSheet = await AttendanceSheet.findOne({
          where: { eventId, isActive: true },
        });
        if (activeSheet) {
          activeSheetId = activeSheet.id;
        }
      }
    }

    // Build where clause
    const where: any = { eventId };
    if (status) {
      where.status = status;
    }
    // Only filter by sheet if explicitly requested
    if (activeSheetId && filterBySheet) {
      where.attendanceSheetId = activeSheetId;
    }

    const attendances = await Attendance.findAll({
      where,
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'fullName', 'photoUrl', 'nyuEmail', 'campus', 'cohort', 'status', 'strikeCount'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model: AttendanceSheet,
          as: 'attendanceSheet',
          attributes: ['id', 'name', 'busNumber'],
        },
      ],
      order: [['markedAt', 'DESC']],
    });

    // Get attendance summary for the active sheet
    const summary = {
      total: attendances.length,
      present: attendances.filter(a => a.status === AttendanceStatus.PRESENT).length,
      absent: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
      notMarked: attendances.filter(a => a.status === AttendanceStatus.NOT_MARKED).length,
    };

    sendSuccess(res, { attendances, summary, activeSheetId });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch attendance', 500);
  }
};

// Get attendance summary for an event (counts only)
export const getEventAttendanceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    const present = await Attendance.count({ where: { eventId, status: AttendanceStatus.PRESENT } });
    const absent = await Attendance.count({ where: { eventId, status: AttendanceStatus.ABSENT } });
    const notMarked = await Attendance.count({ where: { eventId, status: AttendanceStatus.NOT_MARKED } });

    sendSuccess(res, {
      total: present + absent + notMarked,
      present,
      absent,
      notMarked,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch attendance summary', 500);
  }
};

// Mark attendance for a single student
export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, studentId } = req.params;
    const { status, notes, isHandOffMode, attendanceSheetId } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Validate status
    if (!Object.values(AttendanceStatus).includes(status)) {
      sendError(res, 'Invalid attendance status', 400);
      return;
    }

    // Check if event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot mark attendance for a locked event', 403);
      return;
    }

    // Check if student exists
    const student = await Student.findByPk(studentId);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    // Get active sheet if no sheetId provided
    let sheetId = attendanceSheetId;
    if (!sheetId) {
      const activeSheet = await AttendanceSheet.findOne({
        where: { eventId, isActive: true },
      });
      if (activeSheet) {
        sheetId = activeSheet.id;
      }
    }

    // Find or create attendance record for this sheet
    const whereClause: any = { eventId, studentId };
    if (sheetId) {
      whereClause.attendanceSheetId = sheetId;
    } else {
      whereClause.attendanceSheetId = { [Op.is]: null };
    }

    const [attendance, created] = await Attendance.findOrCreate({
      where: whereClause,
      defaults: {
        eventId,
        studentId,
        attendanceSheetId: sheetId || undefined,
        status,
        markedByStaffId: staffId,
        notes,
        isHandOffMode: isHandOffMode || false,
        markedAt: new Date(),
      } as any,
    });

    if (!created) {
      // Update existing record
      await attendance.update({
        status,
        markedByStaffId: staffId,
        notes: notes !== undefined ? notes : attendance.notes,
        isHandOffMode: isHandOffMode !== undefined ? isHandOffMode : attendance.isHandOffMode,
        markedAt: new Date(),
      });
    }

    // Fetch with associations
    const updatedAttendance = await Attendance.findByPk(attendance.id, {
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'fullName', 'photoUrl', 'nyuEmail', 'campus', 'status', 'strikeCount'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model: AttendanceSheet,
          as: 'attendanceSheet',
          attributes: ['id', 'name', 'busNumber'],
        },
      ],
    });

    sendSuccess(res, updatedAttendance, created ? 201 : 200);
  } catch (error: any) {
    console.error('❌ Error in markAttendance:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    if (error.name === 'SequelizeValidationError') {
      console.error('❌ Validation errors:', error.errors);
      sendError(res, `Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`, 400);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('❌ Unique constraint error:', error.fields);
      sendError(res, `Duplicate attendance record: ${error.message}`, 409);
    } else {
      sendError(res, error.message || 'Failed to mark attendance', 500);
    }
  }
};

// Bulk mark attendance (e.g., mark all as absent)
export const bulkMarkAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { studentIds, status, notes } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Validate status
    if (!Object.values(AttendanceStatus).includes(status)) {
      sendError(res, 'Invalid attendance status', 400);
      return;
    }

    // Check if event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot mark attendance for a locked event', 403);
      return;
    }

    // Validate studentIds
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      sendError(res, 'Student IDs are required', 400);
      return;
    }

    let updated = 0;
    let created = 0;

    for (const studentId of studentIds) {
      const [attendance, wasCreated] = await Attendance.findOrCreate({
        where: { eventId, studentId },
        defaults: {
          eventId,
          studentId,
          status,
          markedByStaffId: staffId,
          notes,
          markedAt: new Date(),
        },
      });

      if (!wasCreated) {
        await attendance.update({
          status,
          markedByStaffId: staffId,
          notes: notes || attendance.notes,
          markedAt: new Date(),
        });
        updated++;
      } else {
        created++;
      }
    }

    sendSuccess(res, { created, updated, total: studentIds.length });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to bulk mark attendance', 500);
  }
};

// Mark all unmarked students as absent
export const markAllAbsent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Check if event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot mark attendance for a locked event', 403);
      return;
    }

    // Important: only mark absent for the currently active sheet (i.e., the active bus).
    const activeSheet = await AttendanceSheet.findOne({
      where: { eventId, isActive: true },
    });

    if (!activeSheet) {
      sendError(res, 'No active attendance sheet for this event', 400);
      return;
    }

    const now = new Date();

    // "Assigned students" in this app are represented by any Attendance row for the event.
    // We use that same definition as the frontend (`getEventAssignments`) to avoid mismatches.
    const assignedRows = await Attendance.findAll({
      where: { eventId },
      attributes: ['studentId'],
      raw: true,
    });

    const assignedStudentIds = Array.from(new Set(assignedRows.map((r) => r.studentId)));

    if (assignedStudentIds.length === 0) {
      sendSuccess(res, { created: 0, updated: 0, total: 0 }, 200, '0 students marked as absent');
      return;
    }

    // Look up what we already have for this active sheet, so we only mark those
    // that are currently unmarked on THIS bus/sheet.
    const activeSheetAttendances = await Attendance.findAll({
      where: {
        eventId,
        attendanceSheetId: activeSheet.id,
        studentId: { [Op.in]: assignedStudentIds },
      },
      attributes: ['id', 'studentId', 'status'],
    });

    const recordsByStudentId = new Map<string, Array<{ id: string; status: AttendanceStatus }>>();
    for (const row of activeSheetAttendances) {
      const list = recordsByStudentId.get(row.studentId) || [];
      list.push({ id: row.id, status: row.status });
      recordsByStudentId.set(row.studentId, list);
    }

    const updateIds: string[] = [];
    const createStudentIds: string[] = [];

    for (const studentId of assignedStudentIds) {
      const records = recordsByStudentId.get(studentId) || [];

      // No record on this active sheet => consider it unmarked on this bus.
      if (records.length === 0) {
        createStudentIds.push(studentId);
        continue;
      }

      // Mark only the active-sheet "not_marked" records as absent.
      for (const record of records) {
        if (record.status === AttendanceStatus.NOT_MARKED) {
          updateIds.push(record.id);
        }
      }
    }

    let updatedCount = 0;
    if (updateIds.length > 0) {
      const [count] = await Attendance.update(
        {
          status: AttendanceStatus.ABSENT,
          markedByStaffId: staffId,
          markedAt: now,
        },
        { where: { id: updateIds } }
      );
      updatedCount = count;
    }

    let createdCount = 0;
    if (createStudentIds.length > 0) {
      await Attendance.bulkCreate(
        createStudentIds.map((studentId) => ({
          eventId,
          studentId,
          attendanceSheetId: activeSheet.id,
          status: AttendanceStatus.ABSENT,
          markedByStaffId: staffId,
          markedAt: now,
          // `isHandOffMode` defaults to false in the model.
        }))
      );
      createdCount = createStudentIds.length;
    }

    sendSuccess(
      res,
      { created: createdCount, updated: updatedCount, total: assignedStudentIds.length },
      200,
      `${createdCount + updatedCount} attendance records marked as absent for ${activeSheet.busNumber}`
    );
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark all absent', 500);
  }
};

// Update attendance notes
export const updateAttendanceNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { attendanceId } = req.params;
    const { notes } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const attendance = await Attendance.findByPk(attendanceId, {
      include: [{ model: Event, as: 'event' }],
    });

    if (!attendance) {
      sendError(res, 'Attendance record not found', 404);
      return;
    }

    // Check if event is locked
    const event = await Event.findByPk(attendance.eventId);
    if (event?.isLocked) {
      sendError(res, 'Cannot update attendance for a locked event', 403);
      return;
    }

    await attendance.update({ notes });

    sendSuccess(res, attendance);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update notes', 500);
  }
};

// Get attendance history for a student
export const getStudentAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await Student.findByPk(studentId);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    const attendances = await Attendance.findAll({
      where: { studentId },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'startDate', 'location', 'attendanceMode'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName'],
        },
        {
          model: AttendanceSheet,
          as: 'attendanceSheet',
          attributes: ['id', 'name', 'busNumber'],
        },
      ],
      order: [['markedAt', 'DESC']],
    });

    // Calculate stats
    const stats = {
      total: attendances.length,
      present: attendances.filter(a => a.status === AttendanceStatus.PRESENT).length,
      absent: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
      attendanceRate: attendances.length > 0
        ? Math.round((attendances.filter(a => a.status === AttendanceStatus.PRESENT).length / attendances.length) * 100)
        : 0,
    };

    sendSuccess(res, { attendances, stats });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch student attendance', 500);
  }
};

// Quick tap - toggle between present and not_marked
export const quickTapAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, studentId } = req.params;
    const { isHandOffMode } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Check if event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot mark attendance for a locked event', 403);
      return;
    }

    // Get active sheet
    const activeSheet = await AttendanceSheet.findOne({
      where: { eventId, isActive: true },
    });

    const sheetId = activeSheet?.id || null;

    // Find existing attendance for this sheet
    const sheetWhere: any = { eventId, studentId };
    if (sheetId) {
      sheetWhere.attendanceSheetId = sheetId;
    } else {
      sheetWhere.attendanceSheetId = { [Op.is]: null };
    }
    let attendance = await Attendance.findOne({ where: sheetWhere });

    // If not found and we have a sheetId, also check for records with null sheetId
    if (!attendance && sheetId) {
      const nullSheetAttendance = await Attendance.findOne({
        where: {
          eventId,
          studentId,
          attendanceSheetId: { [Op.is]: null },
        } as any,
      });
      
      if (nullSheetAttendance) {
        // Update the existing record to use the current sheet
        await nullSheetAttendance.update({
          attendanceSheetId: sheetId,
        });
        attendance = nullSheetAttendance;
      }
    }

    // If still not found, create a new record
    let wasCreated = false;
    if (!attendance) {
      try {
        attendance = await Attendance.create({
          eventId,
          studentId,
          attendanceSheetId: sheetId || undefined,
          status: AttendanceStatus.PRESENT,
          markedByStaffId: staffId,
          isHandOffMode: isHandOffMode || false,
          markedAt: new Date(),
        });
        wasCreated = true;
      } catch (createError: any) {
        console.error('❌ Error creating attendance:', createError);
        // If unique constraint error, try to find the record again (race condition)
        if (createError.name === 'SequelizeUniqueConstraintError') {
          const retryWhere: any = { eventId, studentId };
          if (sheetId) {
            retryWhere.attendanceSheetId = sheetId;
          } else {
            retryWhere.attendanceSheetId = { [Op.is]: null };
          }
          attendance = await Attendance.findOne({ where: retryWhere });
          if (!attendance) {
            if (sheetId) {
              attendance = await Attendance.findOne({
                where: {
                  eventId,
                  studentId,
                  attendanceSheetId: { [Op.is]: null },
                } as any,
              });
              if (attendance) {
                await attendance.update({ attendanceSheetId: sheetId });
              }
            }
            if (!attendance) {
              throw createError;
            }
          }
          wasCreated = false;
        } else {
          throw createError;
        }
      }
    }

    let newStatus: AttendanceStatus;

    if (wasCreated) {
      // New record was created as present
      newStatus = AttendanceStatus.PRESENT;
    } else {
      // Existing record - toggle between present and not_marked
      newStatus = attendance.status === AttendanceStatus.PRESENT
        ? AttendanceStatus.NOT_MARKED
        : AttendanceStatus.PRESENT;

      await attendance.update({
        status: newStatus,
        markedByStaffId: staffId,
        isHandOffMode: isHandOffMode !== undefined ? isHandOffMode : attendance.isHandOffMode,
        markedAt: new Date(),
      });
      
      // Reload to get updated status
      await attendance.reload();
    }

    // Fetch with associations
    const updatedAttendance = await Attendance.findByPk(attendance.id, {
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'fullName', 'photoUrl', 'nyuEmail', 'campus', 'status', 'strikeCount'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model: AttendanceSheet,
          as: 'attendanceSheet',
          attributes: ['id', 'name', 'busNumber'],
        },
      ],
    });

    sendSuccess(res, updatedAttendance);
  } catch (error: any) {
    console.error('❌ Error in quickTapAttendance:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.name === 'SequelizeValidationError') {
      console.error('❌ Validation errors:', error.errors);
      sendError(res, `Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`, 400);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('❌ Unique constraint error:', error.fields);
      sendError(res, `Duplicate attendance record: ${error.message}`, 409);
    } else {
      sendError(res, error.message || 'Failed to toggle attendance', 500);
    }
  }
};

// Export attendance for an event as CSV
export const exportEventAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    const attendances = await Attendance.findAll({
      where: { eventId },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'fullName', 'nyuEmail', 'campus', 'cohort', 'strikeCount'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName', 'email'],
        },
      ],
      order: [[{ model: Student, as: 'student' }, 'fullName', 'ASC']],
    });

    // Build CSV
    const csvRows = [
      // Header row
      ['Student Name', 'Email', 'Campus', 'Cohort', 'Status', 'Marked At', 'Marked By', 'Hand-Off Mode', 'Notes', 'Strike Count'].join(','),
    ];

    for (const att of attendances) {
      const student = (att as any).student;
      const markedBy = (att as any).markedBy;
      
      csvRows.push([
        `"${student?.fullName || 'Unknown'}"`,
        `"${student?.nyuEmail || ''}"`,
        `"${student?.campus || ''}"`,
        `"${student?.cohort || ''}"`,
        `"${att.status}"`,
        `"${att.markedAt ? new Date(att.markedAt).toISOString() : ''}"`,
        `"${markedBy?.fullName || ''}"`,
        `"${att.isHandOffMode ? 'Yes' : 'No'}"`,
        `"${att.notes?.replace(/"/g, '""') || ''}"`,
        `"${student?.strikeCount || 0}"`,
      ].join(','));
    }

    const csv = csvRows.join('\n');
    const eventDate = event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : 'unknown';
    const filename = `attendance_${event.name.replace(/[^a-z0-9]/gi, '_')}_${eventDate}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to export attendance', 500);
  }
};

// Export all attendance for a date range
export const exportAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Build where clause for events
    const eventWhere: any = {};
    if (startDate || endDate) {
      eventWhere.startDate = {};
      if (startDate) eventWhere.startDate[Op.gte] = new Date(startDate as string);
      if (endDate) eventWhere.startDate[Op.lte] = new Date(endDate as string);
    }

    const events = await Event.findAll({
      where: eventWhere,
      order: [['startDate', 'ASC']],
    });

    // Build CSV with all attendance
    const csvRows = [
      ['Event Name', 'Event Date', 'Student Name', 'Email', 'Campus', 'Status', 'Marked At', 'Marked By', 'Notes'].join(','),
    ];

    for (const event of events) {
      const attendances = await Attendance.findAll({
        where: { eventId: event.id },
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['fullName', 'nyuEmail', 'campus'],
          },
          {
            model: Staff,
            as: 'markedBy',
            attributes: ['fullName'],
          },
        ],
        order: [[{ model: Student, as: 'student' }, 'fullName', 'ASC']],
      });

      for (const att of attendances) {
        const student = (att as any).student;
        const markedBy = (att as any).markedBy;
        const eventDate = event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '';

        csvRows.push([
          `"${event.name}"`,
          `"${eventDate}"`,
          `"${student?.fullName || 'Unknown'}"`,
          `"${student?.nyuEmail || ''}"`,
          `"${student?.campus || ''}"`,
          `"${att.status}"`,
          `"${att.markedAt ? new Date(att.markedAt).toISOString() : ''}"`,
          `"${markedBy?.fullName || ''}"`,
          `"${att.notes?.replace(/"/g, '""') || ''}"`,
        ].join(','));
      }
    }

    const csv = csvRows.join('\n');
    const filename = `attendance_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to export attendance report', 500);
  }
};

