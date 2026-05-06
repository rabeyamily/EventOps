import { Request, Response } from 'express';
import { Strike } from '../models/Strike';
import { Student } from '../models/Student';
import { Event } from '../models/Event';
import { Staff } from '../models/Staff';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { sendSuccess, sendError } from '../utils/response';
import { Op } from 'sequelize';

// Get all strikes for a student
export const getStudentStrikes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { includeExcused } = req.query;

    const student = await Student.findByPk(studentId);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    const where: any = { studentId };
    if (includeExcused !== 'true') {
      where.isExcused = false;
    }

    const strikes = await Strike.findAll({
      where,
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'startDate', 'location'],
        },
        {
          model: Staff,
          as: 'excusedBy',
          attributes: ['id', 'fullName', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Calculate stats
    const stats = {
      total: strikes.length,
      active: strikes.filter(s => !s.isExcused).length,
      excused: strikes.filter(s => s.isExcused).length,
    };

    sendSuccess(res, { strikes, stats, studentStatus: student.status });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch strikes', 500);
  }
};

// Create a strike manually (admin only)
export const createStrike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, eventId, reason } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Verify student exists
    const student = await Student.findByPk(studentId);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    // Verify event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Check if strike already exists for this student/event
    const existingStrike = await Strike.findOne({ where: { studentId, eventId } });
    if (existingStrike) {
      sendError(res, 'Strike already exists for this student and event', 400);
      return;
    }

    // Create the strike
    const strike = await Strike.create({
      studentId,
      eventId,
      reason: reason || `Absent from ${event.name}`,
      isExcused: false,
    });

    // Fetch with associations
    const createdStrike = await Strike.findByPk(strike.id, {
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Student, as: 'student', attributes: ['id', 'fullName', 'status', 'strikeCount'] },
      ],
    });

    sendSuccess(res, createdStrike, 201);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to create strike', 500);
  }
};

// Excuse a strike (admin only)
export const excuseStrike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strikeId } = req.params;
    const { reason } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const strike = await Strike.findByPk(strikeId, {
      include: [
        { model: Student, as: 'student' },
        { model: Event, as: 'event' },
      ],
    });

    if (!strike) {
      sendError(res, 'Strike not found', 404);
      return;
    }

    if (strike.isExcused) {
      sendError(res, 'Strike is already excused', 400);
      return;
    }

    // Update the strike
    await strike.update({
      isExcused: true,
      excusedByStaffId: staffId,
      excusedAt: new Date(),
      excusedReason: reason || 'Excused by admin',
    });

    // Refetch with associations
    const updatedStrike = await Strike.findByPk(strikeId, {
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'excusedBy', attributes: ['id', 'fullName', 'email'] },
        { model: Student, as: 'student', attributes: ['id', 'fullName', 'status', 'strikeCount'] },
      ],
    });

    sendSuccess(res, updatedStrike);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to excuse strike', 500);
  }
};

// Un-excuse a strike (reinstate)
export const reinstateStrike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strikeId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const strike = await Strike.findByPk(strikeId, {
      include: [
        { model: Student, as: 'student' },
        { model: Event, as: 'event' },
      ],
    });

    if (!strike) {
      sendError(res, 'Strike not found', 404);
      return;
    }

    if (!strike.isExcused) {
      sendError(res, 'Strike is not excused', 400);
      return;
    }

    // Update the strike
    await strike.update({
      isExcused: false,
      excusedByStaffId: undefined,
      excusedAt: undefined,
      excusedReason: undefined,
    });

    // Refetch with associations
    const updatedStrike = await Strike.findByPk(strikeId, {
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Student, as: 'student', attributes: ['id', 'fullName', 'status', 'strikeCount'] },
      ],
    });

    sendSuccess(res, updatedStrike);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to reinstate strike', 500);
  }
};

// Delete a strike (admin only)
export const deleteStrike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strikeId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const strike = await Strike.findByPk(strikeId, {
      include: [
        { model: Student, as: 'student' },
        { model: Event, as: 'event' },
      ],
    });

    if (!strike) {
      sendError(res, 'Strike not found', 404);
      return;
    }

    await strike.destroy();

    sendSuccess(res, null, 200, 'Strike deleted successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete strike', 500);
  }
};

// Process strikes for an event (run when event is locked)
export const processEventStrikes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Get all absent attendance records for this event
    const absentAttendances = await Attendance.findAll({
      where: { eventId, status: AttendanceStatus.ABSENT },
      include: [{ model: Student, as: 'student' }],
    });

    let strikesCreated = 0;
    let strikesSkipped = 0;

    for (const attendance of absentAttendances) {
      // Check if strike already exists
      const existingStrike = await Strike.findOne({
        where: { studentId: attendance.studentId, eventId },
      });

      if (existingStrike) {
        strikesSkipped++;
        continue;
      }

      // Create strike
      await Strike.create({
        studentId: attendance.studentId,
        eventId,
        reason: `Absent from ${event.name}`,
        isExcused: false,
      });

      strikesCreated++;
    }

    sendSuccess(res, { strikesCreated, strikesSkipped }, 200, `${strikesCreated} strikes created`);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to process event strikes', 500);
  }
};

// Get students at risk (1+ strikes)
export const getStudentsAtRisk = async (req: Request, res: Response): Promise<void> => {
  try {
    const where: any = { strikeCount: { [Op.gte]: 1 } };
    
    // Filter by cohort if provided (semester-based filtering)
    const cohort = req.query.cohort as string | undefined;
    if (cohort && /^(Spring|Fall)\s+\d{4}$/.test(cohort)) {
      where[Op.and] = [
        { strikeCount: { [Op.gte]: 1 } },
        {
          [Op.or]: [
            { primaryCohort: cohort },
            { cohort: cohort },
          ],
        },
      ];
      delete where.strikeCount;
    }

    const students = await Student.findAll({
      where,
      include: [
        {
          model: Strike,
          as: 'strikes',
          where: { isExcused: false },
          required: false,
          include: [
            { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
          ],
        },
      ],
      order: [['strikeCount', 'DESC'], ['fullName', 'ASC']],
    });

    const oneStrike = students.filter(s => s.strikeCount === 1);
    const blocked = students.filter(s => s.strikeCount >= 2);

    sendSuccess(res, {
      students,
      summary: {
        total: students.length,
        oneStrike: oneStrike.length,
        blocked: blocked.length,
      },
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch at-risk students', 500);
  }
};

