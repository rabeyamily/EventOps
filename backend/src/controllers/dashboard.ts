import { Request, Response } from 'express';
import { Student, StudentStatus } from '../models/Student';
import { Event } from '../models/Event';
import { Attendance, AttendanceStatus } from '../models/Attendance';
import { AttendanceSheet } from '../models/AttendanceSheet';
import { Strike } from '../models/Strike';
import { Staff } from '../models/Staff';
import { SystemSettings } from '../models/SystemSettings';
import { parseSemester, formatSemester, getSemesterFromDate } from '../utils/semester';
import { Semester } from '../models/Event';
import { sendSuccess, sendError } from '../utils/response';
import { formatEventTeamLeaderNames } from '../utils/event-team-leaders';
import { Op, fn, col } from 'sequelize';
const DASHBOARD_EVENT_LEADER_INCLUDES = [
  { model: Staff, as: 'leadOrganizer', attributes: ['fullName'] },
  { model: Staff, as: 'leadOrganizer2', attributes: ['fullName'] },
  { model: Staff, as: 'leadOrganizer3', attributes: ['fullName'] },
];

// Get admin dashboard stats
export const getAdminDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    // Cohort to filter by: optional query param (viewing semester) or system current semester
    let currentCohort: string | null = (req.query.cohort as string) || null;
    if (currentCohort && !/^(Spring|Fall)\s+\d{4}$/.test(currentCohort)) {
      currentCohort = null;
    }
    if (!currentCohort) {
      try {
        const semesterSetting = await SystemSettings.findOne({ 
          where: { key: 'current_semester' } 
        });
        if (semesterSetting && semesterSetting.value) {
          currentCohort = semesterSetting.value; // e.g., "Spring 2026"
        } else {
          const { semester, academicYear } = getSemesterFromDate(new Date());
          currentCohort = formatSemester(semester, academicYear);
        }
      } catch (err) {
        console.error('Failed to fetch current semester, using all students:', err);
      }
    }

    // Build where clause for current cohort - students whose primary cohort is this semester
    let cohortWhere: any = {};
    if (currentCohort) {
      cohortWhere = {
        [Op.or]: [
          { primaryCohort: currentCohort },
          { cohort: currentCohort },
        ],
      };
    }

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Student stats - filtered by current cohort
    const totalStudents = await Student.count({ where: cohortWhere });
    const studentsByCampus = await Student.findAll({
      attributes: ['campus', [fn('COUNT', col('id')), 'count']],
      where: cohortWhere,
      group: ['campus'],
    });
    const studentsByStatus = await Student.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: cohortWhere,
      group: ['status'],
    });

    // Strike breakdown - filtered by current cohort
    const zeroStrikeWhere = currentCohort 
      ? { [Op.and]: [cohortWhere, { strikeCount: 0 }] }
      : { strikeCount: 0 };
    const zeroStrikeStudents = await Student.count({ where: zeroStrikeWhere });
    
    const oneStrikeWhere = currentCohort 
      ? { [Op.and]: [cohortWhere, { strikeCount: 1 }] }
      : { strikeCount: 1 };
    const oneStrikeStudents = await Student.count({ where: oneStrikeWhere });
    
    const twoPlusStrikeWhere = currentCohort
      ? {
          [Op.and]: [
            cohortWhere,
            {
              [Op.or]: [
                { strikeCount: { [Op.gte]: 2 } },
                { status: StudentStatus.BLOCKED }
              ]
            }
          ]
        }
      : {
          [Op.or]: [
            { strikeCount: { [Op.gte]: 2 } },
            { status: StudentStatus.BLOCKED }
          ]
        };
    const twoPlusStrikeStudents = await Student.count({ where: twoPlusStrikeWhere });
    
    const blockedWhere = currentCohort
      ? { [Op.and]: [cohortWhere, { status: StudentStatus.BLOCKED }] }
      : { status: StudentStatus.BLOCKED };
    const blockedStudents = await Student.count({ where: blockedWhere });

    // Build semester date range for event filtering
    let semesterEventWhere: any = {};
    if (currentCohort) {
      const parsed = parseSemester(currentCohort);
      if (parsed) {
        let startMonth: number, endMonth: number;
        if (parsed.semester === Semester.SPRING) {
          startMonth = 0; endMonth = 4;
        } else {
          startMonth = 7; endMonth = 11;
        }
        const semStart = new Date(parsed.academicYear, startMonth, 1);
        const semEnd = new Date(parsed.academicYear, endMonth + 1, 0, 23, 59, 59);
        semesterEventWhere = { startDate: { [Op.between]: [semStart, semEnd] } };
      }
    }

    // Event stats - scoped by semester
    const totalEvents = await Event.count({ where: semesterEventWhere });
    const upcomingEventsWhere = semesterEventWhere.startDate
      ? { startDate: { ...semesterEventWhere.startDate, [Op.gte]: today } }
      : { startDate: { [Op.gte]: today } };
    const upcomingEvents = await Event.count({ where: upcomingEventsWhere });
    const todaysEventsWhere = semesterEventWhere.startDate
      ? { startDate: { ...semesterEventWhere.startDate, [Op.gte]: today, [Op.lt]: tomorrow } }
      : { startDate: { [Op.gte]: today, [Op.lt]: tomorrow } };
    const todaysEvents = await Event.count({ where: todaysEventsWhere });
    const lockedEventsWhere = semesterEventWhere.startDate
      ? { ...semesterEventWhere, isLocked: true }
      : { isLocked: true };
    const lockedEvents = await Event.count({ where: lockedEventsWhere });

    // Attendance stats - scoped by semester events
    let attendanceEventIds: string[] | null = null;
    if (semesterEventWhere.startDate) {
      const semEvents = await Event.findAll({ where: semesterEventWhere, attributes: ['id'] });
      attendanceEventIds = semEvents.map(e => e.id);
    }
    const attendanceWhere = attendanceEventIds ? { eventId: { [Op.in]: attendanceEventIds } } : {};
    const totalAttendanceRecords = await Attendance.count({ where: attendanceWhere });
    const presentCount = await Attendance.count({ where: { ...attendanceWhere, status: AttendanceStatus.PRESENT } });
    const absentCount = await Attendance.count({ where: { ...attendanceWhere, status: AttendanceStatus.ABSENT } });

    // Strike stats - scoped by semester events
    const strikeWhere = attendanceEventIds ? { eventId: { [Op.in]: attendanceEventIds } } : {};
    const totalStrikes = await Strike.count({ where: strikeWhere });
    const activeStrikes = await Strike.count({ where: { ...strikeWhere, isExcused: false } });
    const excusedStrikes = await Strike.count({ where: { ...strikeWhere, isExcused: true } });
    const strikesThisWeek = await Strike.count({
      where: { ...strikeWhere, createdAt: { [Op.gte]: weekAgo } },
    });

    // Staff stats
    const totalStaff = await Staff.count();
    const adminCount = await Staff.count({ where: { role: 'admin' } });

    // Today's events with attendance stats
    const todaysEventsList = await Event.findAll({
      where: {
        startDate: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
      include: [
        ...DASHBOARD_EVENT_LEADER_INCLUDES,
        {
          model: Attendance,
          as: 'attendances',
          attributes: ['id', 'status', 'studentId'],
          required: false,
        },
      ],
      order: [['startDate', 'ASC']],
    });

    // Calculate attendance stats for today's events
    const todaysEventsWithStats = await Promise.all(todaysEventsList.map(async (event: any) => {
      // Get all attendance records for this event
      const allAttendances = await Attendance.findAll({
        where: { eventId: event.id },
        attributes: ['studentId', 'status'],
      });
      
      // Count unique students
      const uniqueStudentIds = new Set(allAttendances.map((a: any) => a.studentId));
      const totalAssigned = uniqueStudentIds.size;
      
      // Count students with present status (on any sheet)
      const presentStudentIds = new Set(
        allAttendances
          .filter((a: any) => a.status === AttendanceStatus.PRESENT)
          .map((a: any) => a.studentId)
      );
      const present = presentStudentIds.size;
      
      // Count students not marked (no present or absent status)
      const markedStudentIds = new Set(
        allAttendances
          .filter((a: any) => 
            a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.ABSENT
          )
          .map((a: any) => a.studentId)
      );
      const notMarked = totalAssigned - markedStudentIds.size;
      
      const completionRate = totalAssigned > 0 ? Math.round((present / totalAssigned) * 100) : 0;
      
      return {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        startTime: event.startTime,
        location: event.location,
        leadOrganizer: event.leadOrganizer,
        leadOrganizer2: event.leadOrganizer2,
        leadOrganizer3: event.leadOrganizer3,
        teamLeadNames: formatEventTeamLeaderNames(event),
        isLocked: event.isLocked,
        attendance: {
          totalAssigned,
          present,
          notMarked,
          completionRate,
        },
      };
    }));

    // Upcoming events detail (next 7 days)
    const weekFromToday = new Date(today);
    weekFromToday.setDate(weekFromToday.getDate() + 7);
    
    const nextEvents = await Event.findAll({
      where: { 
        startDate: { [Op.gte]: tomorrow, [Op.lt]: weekFromToday } 
      },
      include: [
        ...DASHBOARD_EVENT_LEADER_INCLUDES,
        {
          model: Attendance,
          as: 'attendances',
          attributes: ['id', 'status', 'studentId'],
          required: false,
        },
      ],
      order: [['startDate', 'ASC']],
      limit: 10,
    });

    // Calculate attendance stats for upcoming events
    const upcomingEventsWithStats = await Promise.all(nextEvents.map(async (event: any) => {
      // Get all attendance records for this event
      const allAttendances = await Attendance.findAll({
        where: { eventId: event.id },
        attributes: ['studentId', 'status'],
      });
      
      // Count unique students
      const uniqueStudentIds = new Set(allAttendances.map((a: any) => a.studentId));
      const totalAssigned = uniqueStudentIds.size;
      
      // Count students with present status (on any sheet)
      const presentStudentIds = new Set(
        allAttendances
          .filter((a: any) => a.status === AttendanceStatus.PRESENT)
          .map((a: any) => a.studentId)
      );
      const present = presentStudentIds.size;
      
      // Count students not marked (no present or absent status)
      const markedStudentIds = new Set(
        allAttendances
          .filter((a: any) => 
            a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.ABSENT
          )
          .map((a: any) => a.studentId)
      );
      const notMarked = totalAssigned - markedStudentIds.size;
      
      const completionRate = totalAssigned > 0 ? Math.round((present / totalAssigned) * 100) : 0;
      
      return {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        startTime: event.startTime,
        location: event.location,
        leadOrganizer: event.leadOrganizer,
        leadOrganizer2: event.leadOrganizer2,
        leadOrganizer3: event.leadOrganizer3,
        teamLeadNames: formatEventTeamLeaderNames(event),
        isLocked: event.isLocked,
        attendance: {
          totalAssigned,
          present,
          notMarked,
          completionRate,
        },
      };
    }));

    // Students missing phone number
    const missingInfoWhere = currentCohort
      ? {
          [Op.and]: [
            cohortWhere,
            {
              [Op.or]: [{ uaePhone: { [Op.is]: null } }, { uaePhone: '' }],
            },
          ],
        }
      : {
          [Op.or]: [{ uaePhone: { [Op.is]: null } }, { uaePhone: '' }],
        };
    const totalStudentsMissingInfo = await Student.count({
      where: missingInfoWhere,
    });

    const studentsMissingInfo = await Student.findAll({
      where: missingInfoWhere,
      attributes: ['id', 'fullName', 'nyuEmail'],
      limit: 10,
    });

    // Build action items
    const actionItems = [];
    
    // Events needing attention (today's events with incomplete attendance)
    todaysEventsWithStats.forEach((event: any) => {
      if (event.attendance.notMarked > 0 && !event.isLocked) {
        actionItems.push({
          type: 'ATTENDANCE',
          priority: 'high',
          message: `${event.name} - ${event.attendance.notMarked} students not checked in`,
          eventId: event.id,
          eventName: event.name,
          count: event.attendance.notMarked,
        });
      }
    });

    // Students with strikes
    if (oneStrikeStudents > 0) {
      actionItems.push({
        type: 'STRIKE',
        priority: 'medium',
        message: `${oneStrikeStudents} student${oneStrikeStudents !== 1 ? 's' : ''} with 1 strike`,
        count: oneStrikeStudents,
      });
    }

    if (twoPlusStrikeStudents > 0) {
      actionItems.push({
        type: 'STRIKE',
        priority: 'high',
        message: `${twoPlusStrikeStudents} student${twoPlusStrikeStudents !== 1 ? 's' : ''} with 2+ strikes (blocked)`,
        count: twoPlusStrikeStudents,
      });
    }

    // Students missing information
    if (totalStudentsMissingInfo > 0) {
      actionItems.push({
        type: 'STUDENT_INFO',
        priority: 'low',
        message: `${totalStudentsMissingInfo} student${totalStudentsMissingInfo !== 1 ? 's' : ''} missing phone number`,
        count: totalStudentsMissingInfo,
      });
    }

    // At-risk students detail - filtered by current cohort
    const atRiskWhere = currentCohort
      ? { [Op.and]: [cohortWhere, { strikeCount: { [Op.gte]: 1 } }] }
      : { strikeCount: { [Op.gte]: 1 } };
    const atRiskStudents = await Student.findAll({
      where: atRiskWhere,
      include: [
        {
          model: Strike,
          as: 'strikes',
          where: { isExcused: false },
          required: false,
        },
      ],
      order: [['strikeCount', 'DESC']],
      limit: 10,
    });

    sendSuccess(res, {
      currentCohort: currentCohort || 'All',
      students: {
        total: totalStudents,
        byCampus: studentsByCampus.map((s: any) => ({ campus: s.campus, count: parseInt(s.dataValues.count) })),
        byStatus: studentsByStatus.map((s: any) => ({ status: s.status, count: parseInt(s.dataValues.count) })),
        strikes: {
          zero: zeroStrikeStudents,
          one: oneStrikeStudents,
          twoPlus: twoPlusStrikeStudents,
        },
        oneStrike: oneStrikeStudents,
        blocked: blockedStudents,
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
        today: todaysEvents,
        locked: lockedEvents,
        next: upcomingEventsWithStats,
        todayList: todaysEventsWithStats,
      },
      attendance: {
        total: totalAttendanceRecords,
        present: presentCount,
        absent: absentCount,
        rate: totalAttendanceRecords > 0 ? Math.round((presentCount / totalAttendanceRecords) * 100) : 0,
      },
      strikes: {
        total: totalStrikes,
        active: activeStrikes,
        excused: excusedStrikes,
        thisWeek: strikesThisWeek,
      },
      staff: {
        total: totalStaff,
        admins: adminCount,
      },
      atRiskStudents,
      recentActivity: [],
      actionItems,
      studentsMissingInfo: studentsMissingInfo.map((s: any) => ({
        id: s.id,
        fullName: s.fullName,
        nyuEmail: s.nyuEmail,
      })),
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};

// Get live event dashboard
export const getLiveEventDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findByPk(eventId, {
      include: DASHBOARD_EVENT_LEADER_INCLUDES,
    });

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Get attendance breakdown
    const attendances = await Attendance.findAll({
      where: { eventId },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'fullName', 'nyuEmail', 'campus', 'strikeCount', 'status'],
        },
      ],
    });

    const present = attendances.filter((a) => a.status === AttendanceStatus.PRESENT);
    const absent = attendances.filter((a) => a.status === AttendanceStatus.ABSENT);
    const notMarked = attendances.filter((a) => a.status === AttendanceStatus.NOT_MARKED);

    // At-risk students in this event
    const atRiskPresent = present.filter((a: any) => a.student?.strikeCount >= 1);
    const atRiskAbsent = absent.filter((a: any) => a.student?.strikeCount >= 1);
    const blockedPresent = present.filter((a: any) => a.student?.status === StudentStatus.BLOCKED);

    sendSuccess(res, {
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        location: event.location,
        isLocked: event.isLocked,
        departedAt: event.departedAt,
        leadOrganizer: (event as any).leadOrganizer,
        leadOrganizer2: (event as any).leadOrganizer2,
        leadOrganizer3: (event as any).leadOrganizer3,
        teamLeadNames: formatEventTeamLeaderNames(event as any),
      },
      stats: {
        total: attendances.length,
        present: present.length,
        absent: absent.length,
        notMarked: notMarked.length,
        attendanceRate: attendances.length > 0 ? Math.round((present.length / attendances.length) * 100) : 0,
      },
      atRisk: {
        presentWithStrikes: atRiskPresent.length,
        absentWithStrikes: atRiskAbsent.length,
        blockedPresent: blockedPresent.length,
      },
      students: {
        present: present.map((a: any) => a.student),
        absent: absent.map((a: any) => a.student),
        notMarked: notMarked.map((a: any) => a.student),
      },
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch live event data', 500);
  }
};

// Get semester report (overall report after semester end)
export const getSemesterReport = async (req: Request, res: Response): Promise<void> => {
  try {
    let semesterString = req.query.semester as string;
    if (!semesterString) {
      const semSetting = await SystemSettings.findOne({ where: { key: 'current_semester' } });
      semesterString = semSetting?.value || formatSemester(...Object.values(getSemesterFromDate(new Date())) as [Semester, number]);
    }

    const parsed = parseSemester(semesterString);
    if (!parsed) {
      sendError(res, 'Invalid semester format. Use "Spring 2026" or "Fall 2025"', 400);
      return;
    }

    let startMonth: number, endMonth: number;
    if (parsed.semester === Semester.SPRING) {
      startMonth = 0; endMonth = 4;
    } else {
      startMonth = 7; endMonth = 11;
    }
    const semStart = new Date(parsed.academicYear, startMonth, 1);
    const semEnd = new Date(parsed.academicYear, endMonth + 1, 0, 23, 59, 59);

    const events = await Event.findAll({
      where: { startDate: { [Op.between]: [semStart, semEnd] } },
      include: [
        ...DASHBOARD_EVENT_LEADER_INCLUDES,
        { model: Attendance, as: 'attendances', attributes: ['id', 'status', 'studentId'] },
        { model: Strike, as: 'strikes', attributes: ['id', 'isExcused'] },
      ],
      order: [['startDate', 'ASC']],
    });

    const eventStats = events.map((event: any) => {
      const atts = event.attendances || [];
      const uniqueStudents = new Set(atts.map((a: any) => a.studentId));
      const totalAssigned = uniqueStudents.size;
      const presentIds = new Set(
        atts.filter((a: any) => a.status === AttendanceStatus.PRESENT).map((a: any) => a.studentId)
      );
      const absentIds = new Set(
        atts.filter((a: any) => a.status === AttendanceStatus.ABSENT).map((a: any) => a.studentId)
      );
      const attendanceRate = totalAssigned > 0 ? Math.round((presentIds.size / totalAssigned) * 100) : 0;
      const strikes = event.strikes || [];

      return {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        location: event.location,
        leadOrganizer: formatEventTeamLeaderNames(event),
        totalAssigned,
        present: presentIds.size,
        absent: absentIds.size,
        attendanceRate,
        strikeCount: strikes.filter((s: any) => !s.isExcused).length,
      };
    });

    // Only rank events that actually have assigned attendees.
    // Avoid labeling 0/0 attendance events as "successful" or "needs improvement".
    const rankableEvents = eventStats.filter((event) => event.totalAssigned > 0);
    const sorted = [...rankableEvents].sort((a, b) => b.attendanceRate - a.attendanceRate);
    const mostSuccessful = sorted[0] || null;
    const leastSuccessful = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    const totalEvents = events.length;
    const overallPresent = eventStats.reduce((sum, e) => sum + e.present, 0);
    const overallTotal = eventStats.reduce((sum, e) => sum + e.totalAssigned, 0);
    const overallRate = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
    const totalStrikes = eventStats.reduce((sum, e) => sum + e.strikeCount, 0);

    const cohortWhere: any = {
      [Op.or]: [
        { primaryCohort: semesterString },
        { cohort: semesterString },
      ],
    };
    const totalStudents = await Student.count({ where: cohortWhere });
    const blockedStudents = await Student.count({ where: { ...cohortWhere, status: StudentStatus.BLOCKED } });
    const oneStrikeStudents = await Student.count({ where: { ...cohortWhere, strikeCount: 1 } });

    sendSuccess(res, {
      semester: semesterString,
      summary: {
        totalEvents,
        totalStudents,
        overallAttendanceRate: overallRate,
        totalPresent: overallPresent,
        totalAssigned: overallTotal,
        totalStrikes,
        blockedStudents,
        oneStrikeStudents,
      },
      mostSuccessfulEvent: mostSuccessful,
      leastSuccessfulEvent: leastSuccessful,
      events: eventStats,
      topEvents: sorted.slice(0, 5),
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to generate semester report', 500);
  }
};

// Get event summary (post-event report)
export const getEventSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findByPk(eventId, {
      include: [
        { model: Staff, as: 'leadOrganizer', attributes: ['fullName', 'email'] },
        { model: Staff, as: 'leadOrganizer2', attributes: ['fullName', 'email'] },
        { model: Staff, as: 'leadOrganizer3', attributes: ['fullName', 'email'] },
      ],
    });

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
          attributes: ['id', 'fullName', 'nyuEmail', 'campus', 'strikeCount', 'status'],
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
    });

    const uniqueStudentMap = new Map<string, any>();
    for (const att of attendances) {
      const sid = att.studentId;
      const existing = uniqueStudentMap.get(sid);
      if (!existing || att.status === AttendanceStatus.PRESENT) {
        uniqueStudentMap.set(sid, att);
      }
    }
    const dedupedAttendances = Array.from(uniqueStudentMap.values());

    const present = dedupedAttendances.filter(a => a.status === AttendanceStatus.PRESENT);
    const absent = dedupedAttendances.filter(a => a.status === AttendanceStatus.ABSENT);
    const notMarked = dedupedAttendances.filter(a => a.status === AttendanceStatus.NOT_MARKED);
    const totalAssigned = dedupedAttendances.length;
    const attendanceRate = totalAssigned > 0 ? Math.round((present.length / totalAssigned) * 100) : 0;

    const absentWithNotes = attendances
      .filter(a => a.status === AttendanceStatus.ABSENT && a.notes)
      .map((a: any) => ({
        studentName: a.student?.fullName,
        studentEmail: a.student?.nyuEmail,
        note: a.notes,
        markedBy: a.markedBy?.fullName,
      }));

    const atRiskStudents = dedupedAttendances
      .filter((a: any) => a.student?.strikeCount >= 1)
      .map((a: any) => ({
        id: a.student.id,
        fullName: a.student.fullName,
        nyuEmail: a.student.nyuEmail,
        strikeCount: a.student.strikeCount,
        status: a.student.status,
        attendanceStatus: a.status,
      }));

    const strikes = await Strike.findAll({
      where: { eventId },
      include: [
        { model: Student, as: 'student', attributes: ['id', 'fullName', 'nyuEmail'] },
      ],
    });

    const campusBreakdown: Record<string, { present: number; absent: number; total: number }> = {};
    for (const att of dedupedAttendances) {
      const campus = (att as any).student?.campus || 'Unknown';
      if (!campusBreakdown[campus]) {
        campusBreakdown[campus] = { present: 0, absent: 0, total: 0 };
      }
      campusBreakdown[campus].total++;
      if (att.status === AttendanceStatus.PRESENT) campusBreakdown[campus].present++;
      if (att.status === AttendanceStatus.ABSENT) campusBreakdown[campus].absent++;
    }

    sendSuccess(res, {
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        attendanceMode: event.attendanceMode,
        isLocked: event.isLocked,
        leadOrganizer: (event as any).leadOrganizer,
        leadOrganizer2: (event as any).leadOrganizer2,
        leadOrganizer3: (event as any).leadOrganizer3,
        teamLeadNames: formatEventTeamLeaderNames(event as any),
        semester: event.semester,
        academicYear: event.academicYear,
      },
      attendance: {
        totalAssigned,
        present: present.length,
        absent: absent.length,
        notMarked: notMarked.length,
        attendanceRate,
      },
      absentWithNotes,
      atRiskStudents,
      strikes: strikes.map((s: any) => ({
        id: s.id,
        studentName: s.student?.fullName,
        studentEmail: s.student?.nyuEmail,
        isExcused: s.isExcused,
        reason: s.reason,
      })),
      campusBreakdown: Object.entries(campusBreakdown).map(([campus, data]) => ({
        campus,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      })),
      presentStudents: present.map((a: any) => ({
        id: a.student?.id,
        fullName: a.student?.fullName,
        nyuEmail: a.student?.nyuEmail,
        campus: a.student?.campus,
      })),
      absentStudents: absent.map((a: any) => ({
        id: a.student?.id,
        fullName: a.student?.fullName,
        nyuEmail: a.student?.nyuEmail,
        campus: a.student?.campus,
        note: a.notes,
      })),
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to generate event summary', 500);
  }
};

// Get risk dashboard
export const getRiskDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    // Students with 1 strike
    const oneStrikeStudents = await Student.findAll({
      where: { strikeCount: 1, status: StudentStatus.ONE_STRIKE },
      include: [
        {
          model: Strike,
          as: 'strikes',
          where: { isExcused: false },
          include: [{ model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] }],
        },
      ],
      order: [['fullName', 'ASC']],
    });

    // Blocked students
    const blockedStudents = await Student.findAll({
      where: { status: StudentStatus.BLOCKED },
      include: [
        {
          model: Strike,
          as: 'strikes',
          where: { isExcused: false },
          include: [{ model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] }],
        },
      ],
      order: [['fullName', 'ASC']],
    });

    // Recent strikes
    const recentStrikes = await Strike.findAll({
      where: { isExcused: false },
      include: [
        { model: Student, as: 'student', attributes: ['id', 'fullName', 'nyuEmail', 'strikeCount'] },
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    // Events with high absence rate
    const eventsWithAbsences = await Event.findAll({
      where: { isLocked: true },
      include: [
        {
          model: Attendance,
          as: 'attendances',
          attributes: ['status'],
        },
      ],
      order: [['startDate', 'DESC']],
      limit: 10,
    });

    const highAbsenceEvents = eventsWithAbsences
      .map((event: any) => {
        const total = event.attendances?.length || 0;
        const absent = event.attendances?.filter((a: any) => a.status === 'absent').length || 0;
        const rate = total > 0 ? Math.round((absent / total) * 100) : 0;
        return {
          id: event.id,
          name: event.name,
          startDate: event.startDate,
          total,
          absent,
          absenceRate: rate,
        };
      })
      .filter((e) => e.absenceRate > 10)
      .sort((a, b) => b.absenceRate - a.absenceRate);

    sendSuccess(res, {
      summary: {
        oneStrike: oneStrikeStudents.length,
        blocked: blockedStudents.length,
        recentStrikes: recentStrikes.length,
      },
      oneStrikeStudents,
      blockedStudents,
      recentStrikes,
      highAbsenceEvents,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch risk dashboard data', 500);
  }
};

