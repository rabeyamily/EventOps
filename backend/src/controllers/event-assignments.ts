import { Request, Response } from 'express';
import { Event } from '../models/Event';
import { Student, StudentStatus } from '../models/Student';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { Staff } from '../models/Staff';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPagination, getSearch } from '../utils/query';
import { Op } from 'sequelize';

// Get assigned students for an event
export const getEventAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);

    // Verify event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Build where clause for attendance records
    const whereClause: any = { eventId };

    // Get assignments with student info
    const { count, rows } = await Attendance.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      include: [
        {
          model: Student,
          as: 'student',
          where: search
            ? {
                [Op.or]: [
                  { fullName: { [Op.iLike]: `%${search}%` } },
                  { nyuEmail: { [Op.iLike]: `%${search}%` } },
                ],
              }
            : undefined,
          required: true,
        },
      ],
      order: [[{ model: Student, as: 'student' }, 'fullName', 'ASC']],
    });

    // Get attendance summary
    const summary = {
      total: count,
      present: await Attendance.count({ where: { eventId, status: AttendanceStatus.PRESENT } }),
      absent: await Attendance.count({ where: { eventId, status: AttendanceStatus.ABSENT } }),
      notMarked: await Attendance.count({ where: { eventId, status: AttendanceStatus.NOT_MARKED } }),
    };

    sendPaginated(res, rows, { page, limit, total: count }, { summary });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch event assignments', 500);
  }
};

// Assign a single student to an event
export const assignStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { studentId } = req.body;
    const currentUser = req.user as any;

    console.log('🔍 Assign student request:', { eventId, studentId, userEmail: currentUser?.email, userRole: currentUser?.role });

    // Verify event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot modify assignments for a locked event', 400);
      return;
    }

    // Verify student exists
    const student = await Student.findByPk(studentId);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    // Check if student is blocked
    if (student.status === StudentStatus.BLOCKED) {
      sendError(res, 'Cannot assign a blocked student to an event', 400);
      return;
    }

    // Check if already assigned
    const existing = await Attendance.findOne({
      where: { eventId, studentId },
    });

    if (existing) {
      console.log('⚠️ Student already assigned:', { eventId, studentId });
      sendError(res, 'Student is already assigned to this event', 400);
      return;
    }

    // Get staff ID
    const staff = await Staff.findOne({ where: { email: currentUser?.email } });
    if (!staff) {
      sendError(res, 'Staff not found', 400);
      return;
    }

    // Create assignment (attendance record with NOT_MARKED status)
    const assignment = await Attendance.create({
      eventId,
      studentId,
      status: AttendanceStatus.NOT_MARKED,
      markedByStaffId: staff.id,
      markedAt: new Date(),
    });

    // Fetch with student info
    const result = await Attendance.findByPk(assignment.id, {
      include: [{ model: Student, as: 'student' }],
    });

    console.log('✅ Student assigned successfully:', { eventId, studentId, assignmentId: assignment.id });

    sendSuccess(res, result, 201, 'Student assigned to event');
  } catch (error: any) {
    console.error('❌ Error assigning student:', error);
    sendError(res, error.message || 'Failed to assign student', 500);
  }
};

// Bulk assign students to an event
export const bulkAssignStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { mode, campus, cohort } = req.body;
    const currentUser = req.user as any;

    // Verify event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot modify assignments for a locked event', 400);
      return;
    }

    // Get staff ID
    const staff = await Staff.findOne({ where: { email: currentUser?.email } });
    if (!staff) {
      sendError(res, 'Staff not found', 400);
      return;
    }

    // Build where clause for students
    const studentWhere: any = {
      status: { [Op.ne]: StudentStatus.BLOCKED }, // Exclude blocked students
    };

    if (mode === 'campus' && campus) {
      studentWhere.campus = campus;
    } else if (mode === 'cohort' && cohort) {
      studentWhere.cohort = cohort;
    }
    // mode === 'all' uses no additional filters

    // Get students to assign
    const students = await Student.findAll({ where: studentWhere });

    // Get already assigned students
    const existingAssignments = await Attendance.findAll({
      where: { eventId },
      attributes: ['studentId'],
    });
    const assignedIds = new Set(existingAssignments.map((a) => a.studentId));

    // Filter out already assigned
    const newStudents = students.filter((s) => !assignedIds.has(s.id));

    // Create assignments
    const assignments = await Attendance.bulkCreate(
      newStudents.map((student) => ({
        eventId,
        studentId: student.id,
        status: AttendanceStatus.NOT_MARKED,
        markedByStaffId: staff.id,
        markedAt: new Date(),
      }))
    );

    sendSuccess(
      res,
      {
        assigned: assignments.length,
        skipped: students.length - newStudents.length,
        total: students.length,
      },
      201,
      `${assignments.length} students assigned to event`
    );
  } catch (error: any) {
    sendError(res, error.message || 'Failed to bulk assign students', 500);
  }
};

// Remove a student from an event
export const removeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, studentId } = req.params;

    // Verify event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot modify assignments for a locked event', 400);
      return;
    }

    // Find assignment
    const assignment = await Attendance.findOne({
      where: { eventId, studentId },
    });

    if (!assignment) {
      sendError(res, 'Student is not assigned to this event', 404);
      return;
    }

    // Don't allow removing if already marked
    if (assignment.status !== AttendanceStatus.NOT_MARKED) {
      sendError(res, 'Cannot remove a student whose attendance has already been marked', 400);
      return;
    }

    await assignment.destroy();

    sendSuccess(res, null, 200, 'Student removed from event');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to remove assignment', 500);
  }
};

// Remove all assignments from an event
export const clearAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    // Verify event exists and is not locked
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Cannot modify assignments for a locked event', 400);
      return;
    }

    // Delete ALL assignments (regardless of status)
    const deleted = await Attendance.destroy({
      where: {
        eventId,
      },
    });

    sendSuccess(res, { removed: deleted }, 200, `${deleted} assignments removed`);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to clear assignments', 500);
  }
};

// Get unassigned students for an event
export const getUnassignedStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const { campus, cohort } = req.query;

    // Verify event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Get already assigned student IDs
    const assignedStudents = await Attendance.findAll({
      where: { eventId },
      attributes: ['studentId'],
    });
    const assignedIds = assignedStudents.map((a) => a.studentId);

    // Build where clause
    const where: any = {
      id: { [Op.notIn]: assignedIds.length > 0 ? assignedIds : ['00000000-0000-0000-0000-000000000000'] },
      status: { [Op.ne]: StudentStatus.BLOCKED }, // Exclude blocked students
    };

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { nyuEmail: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (campus) {
      where.campus = campus;
    }

    if (cohort) {
      where.cohort = cohort;
    }

    // Get unassigned students
    const { count, rows } = await Student.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fullName', 'ASC']],
    });

    sendPaginated(res, rows, { page, limit, total: count });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch unassigned students', 500);
  }
};

