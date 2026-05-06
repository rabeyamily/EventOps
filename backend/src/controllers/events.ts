import { Request, Response } from 'express';
import { Event, AttendanceMode, Semester } from '../models/Event';
import { Staff } from '../models/Staff';
import { SystemSettings } from '../models/SystemSettings';
import { getPagination, getSort, getSearch } from '../utils/query';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getSemesterFromDate, parseSemester } from '../utils/semester';
import { isEligibleGeoLeadOrganizer } from '../utils/geo-lead-organizer';
import { Op } from 'sequelize';

const EVENT_LEADER_INCLUDES = [
  { model: Staff, as: 'leadOrganizer', attributes: ['id', 'fullName', 'email'] },
  { model: Staff, as: 'leadOrganizer2', attributes: ['id', 'fullName', 'email'] },
  { model: Staff, as: 'leadOrganizer3', attributes: ['id', 'fullName', 'email'] },
];

async function validateTeamLeaderAssignments(ids: string[], res: Response): Promise<boolean> {
  if (ids.length === 0) {
    sendError(res, 'At least one team leader is required', 400);
    return false;
  }
  if (new Set(ids).size !== ids.length) {
    sendError(res, 'Team leaders must be distinct people', 400);
    return false;
  }
  for (const id of ids) {
    const s = await Staff.findByPk(id);
    if (!s || !isEligibleGeoLeadOrganizer(s)) {
      sendError(res, 'Each team leader must be a GEO (staff), not an admin', 400);
      return false;
    }
  }
  return true;
}

function normalizeTeamLeaderIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

async function validateGeoAssignments(ids: string[], res: Response): Promise<boolean> {
  if (new Set(ids).size !== ids.length) {
    sendError(res, 'Assigned GEOs must be different people.', 400);
    return false;
  }
  for (const id of ids) {
    const s = await Staff.findByPk(id);
    if (!s || !isEligibleGeoLeadOrganizer(s)) {
      sendError(res, 'Each assigned GEO must be a GEO (staff), not an admin', 400);
      return false;
    }
  }
  return true;
}

// Get all events with pagination and filters
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { orderBy, orderDirection } = getSort(req, 'startDate');
    const search = getSearch(req);

    // Build where clause
    const where: any = {};

    // Search by name or location
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Filter by attendance mode
    if (req.query.attendanceMode) {
      where.attendanceMode = req.query.attendanceMode;
    }

    // Filter by locked status
    if (req.query.isLocked !== undefined) {
      where.isLocked = req.query.isLocked === 'true';
    }

    // Filter by date range
    if (req.query.startDate) {
      where.startDate = {
        ...where.startDate,
        [Op.gte]: new Date(req.query.startDate as string),
      };
    }
    if (req.query.endDate) {
      where.startDate = {
        ...where.startDate,
        [Op.lte]: new Date(req.query.endDate as string),
      };
    }

    // Filter for upcoming events only
    if (req.query.upcoming === 'true') {
      where.startDate = {
        ...where.startDate,
        [Op.gte]: new Date(),
      };
    }

    // Filter for past events only
    if (req.query.past === 'true') {
      where.startDate = {
        ...where.startDate,
        [Op.lt]: new Date(),
      };
    }

    // Filter by semester (using date range instead of semester field)
    // Automatically use current semester if not provided
    let semester: string | undefined = req.query.semester as string | undefined;
    let academicYear: number | undefined = req.query.academicYear ? parseInt(req.query.academicYear as string, 10) : undefined;

    // If semester not provided, fetch from SystemSettings
    if (!semester || !academicYear) {
      try {
        const semesterSetting = await SystemSettings.findOne({ 
          where: { key: 'current_semester' } 
        });
        if (semesterSetting && semesterSetting.value) {
          const parsed = parseSemester(semesterSetting.value);
          if (parsed) {
            semester = parsed.semester;
            academicYear = parsed.academicYear;
          }
        }
      } catch (err) {
        console.error('Failed to fetch current semester:', err);
      }
    }

    // Apply semester date range filter
    if (semester && academicYear) {
      let startMonth: number;
      let endMonth: number;
      
      if (semester === 'Spring' || semester === Semester.SPRING) {
        // Spring: January (1) to May (5)
        startMonth = 0; // January (0-indexed)
        endMonth = 4;   // May (0-indexed)
      } else if (semester === 'Fall' || semester === Semester.FALL) {
        // Fall: August (8) to December (12)
        startMonth = 7;  // August (0-indexed)
        endMonth = 11;   // December (0-indexed)
      } else {
        // Invalid semester, skip filtering
        startMonth = -1;
        endMonth = -1;
      }
      
      if (startMonth >= 0 && endMonth >= 0) {
        const startDate = new Date(academicYear, startMonth, 1);
        const endDate = new Date(academicYear, endMonth + 1, 0, 23, 59, 59); // Last day of the end month
        
        where.startDate = {
          ...where.startDate,
          [Op.between]: [startDate, endDate],
        };
      }
    }

    // Get events with pagination
    const { count, rows } = await Event.findAndCountAll({
      where,
      limit,
      offset,
      order: [[orderBy, orderDirection]],
      include: EVENT_LEADER_INCLUDES,
    });

    sendPaginated(res, rows, { page, limit, total: count });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch events', 500);
  }
};

// Get event by ID
export const getEventById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        ...EVENT_LEADER_INCLUDES,
        {
          model: Staff,
          as: 'lockedBy',
          attributes: ['id', 'fullName', 'email'],
        },
      ],
    });

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    sendSuccess(res, event);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch event', 500);
  }
};

// Create new event
export const createEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      leadOrganizerId,
      leadOrganizer2Id: lead2Raw,
      leadOrganizer3Id: lead3Raw,
      leadOrganizerIds: leadOrganizerIdsRaw,
      assignedGeoIds: assignedGeoIdsRaw,
      attendanceMode,
      notes,
    } = req.body;

    const leadOrganizer2Id = lead2Raw || null;
    const leadOrganizer3Id = lead3Raw || null;
    const leadOrganizerIds = normalizeTeamLeaderIds(leadOrganizerIdsRaw);
    const assignedGeoIds = normalizeTeamLeaderIds(assignedGeoIdsRaw);
    const teamLeaderIds =
      leadOrganizerIds.length > 0
        ? leadOrganizerIds
        : [leadOrganizerId, leadOrganizer2Id, leadOrganizer3Id].filter(
            (x): x is string => typeof x === 'string' && x.length > 0
          );

    // Validate dates
    const parsedStartDate = new Date(startDate);
    if (isNaN(parsedStartDate.getTime())) {
      sendError(res, 'Invalid start date', 400);
      return;
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        sendError(res, 'Invalid end date', 400);
        return;
      }
      if (parsedEndDate < parsedStartDate) {
        sendError(res, 'End date must be after start date', 400);
        return;
      }
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      sendError(res, 'Invalid start time format (use HH:MM)', 400);
      return;
    }
    if (endTime && !timeRegex.test(endTime)) {
      sendError(res, 'Invalid end time format (use HH:MM)', 400);
      return;
    }

    if (!(await validateTeamLeaderAssignments(teamLeaderIds, res))) {
      return;
    }
    if (!(await validateGeoAssignments(assignedGeoIds, res))) {
      return;
    }

    // Auto-detect semester from start date
    const { semester, academicYear } = getSemesterFromDate(parsedStartDate);

    // Create event
    const event = await Event.create({
      name,
      startDate: parsedStartDate,
      endDate: endDate ? new Date(endDate) : undefined,
      startTime,
      endTime,
      location,
      leadOrganizerId: teamLeaderIds[0],
      leadOrganizer2Id: teamLeaderIds[1] || null,
      leadOrganizer3Id: teamLeaderIds[2] || null,
      teamLeaderIds,
      assignedGeoIds,
      attendanceMode: attendanceMode || AttendanceMode.BUS_BASED,
      notes,
      semester,
      academicYear,
      isLocked: false,
    });

    // Fetch the created event with associations
    const createdEvent = await Event.findByPk(event.id, {
      include: EVENT_LEADER_INCLUDES,
    });

    sendSuccess(res, createdEvent, 201, 'Event created successfully');
  } catch (error: any) {
    if (error.name === 'SequelizeValidationError') {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to create event', 500);
  }
};

// Update event
export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const event = await Event.findByPk(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Prevent updates to locked events (unless unlocking)
    if (event.isLocked && !Object.prototype.hasOwnProperty.call(updateData, 'isLocked')) {
      sendError(res, 'Cannot modify a locked event', 400);
      return;
    }

    // Validate dates if provided
    if (updateData.startDate) {
      const parsedStartDate = new Date(updateData.startDate);
      if (isNaN(parsedStartDate.getTime())) {
        sendError(res, 'Invalid start date', 400);
        return;
      }
      updateData.startDate = parsedStartDate;
    }

    if (updateData.endDate) {
      const parsedEndDate = new Date(updateData.endDate);
      if (isNaN(parsedEndDate.getTime())) {
        sendError(res, 'Invalid end date', 400);
        return;
      }
      
      const startDate = updateData.startDate || event.startDate;
      if (parsedEndDate < new Date(startDate)) {
        sendError(res, 'End date must be after start date', 400);
        return;
      }
      updateData.endDate = parsedEndDate;
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (updateData.startTime && !timeRegex.test(updateData.startTime)) {
      sendError(res, 'Invalid start time format (use HH:MM)', 400);
      return;
    }
    if (updateData.endTime && !timeRegex.test(updateData.endTime)) {
      sendError(res, 'Invalid end time format (use HH:MM)', 400);
      return;
    }

    if (
      Array.isArray(updateData.leadOrganizerIds) ||
      Array.isArray(updateData.assignedGeoIds) ||
      updateData.leadOrganizerId !== undefined ||
      Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer2Id') ||
      Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer3Id')
    ) {
      const existingIds =
        Array.isArray((event as any).teamLeaderIds) && (event as any).teamLeaderIds.length > 0
          ? (event as any).teamLeaderIds
          : [event.leadOrganizerId, event.leadOrganizer2Id, event.leadOrganizer3Id].filter(
              (x): x is string => typeof x === 'string' && x.length > 0
            );

      const mergedIds = Array.isArray(updateData.leadOrganizerIds)
        ? normalizeTeamLeaderIds(updateData.leadOrganizerIds)
        : [
            updateData.leadOrganizerId !== undefined ? updateData.leadOrganizerId : existingIds[0],
            Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer2Id')
              ? updateData.leadOrganizer2Id || null
              : existingIds[1] || null,
            Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer3Id')
              ? updateData.leadOrganizer3Id || null
              : existingIds[2] || null,
            ...existingIds.slice(3),
          ].filter((x): x is string => typeof x === 'string' && x.length > 0);

      if (!(await validateTeamLeaderAssignments(mergedIds, res))) {
        return;
      }

      updateData.leadOrganizerId = mergedIds[0];
      updateData.leadOrganizer2Id = mergedIds[1] || null;
      updateData.leadOrganizer3Id = mergedIds[2] || null;
      updateData.teamLeaderIds = mergedIds;
    }
    if (Array.isArray(updateData.assignedGeoIds)) {
      const mergedAssigned = normalizeTeamLeaderIds(updateData.assignedGeoIds);
      if (!(await validateGeoAssignments(mergedAssigned, res))) {
        return;
      }
      updateData.assignedGeoIds = mergedAssigned;
    }
    delete updateData.leadOrganizerIds;

    if (Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer2Id')) {
      updateData.leadOrganizer2Id = updateData.leadOrganizer2Id || null;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'leadOrganizer3Id')) {
      updateData.leadOrganizer3Id = updateData.leadOrganizer3Id || null;
    }

    // Update event
    await event.update(updateData);

    // Fetch updated event with associations
    const updatedEvent = await Event.findByPk(id, {
      include: EVENT_LEADER_INCLUDES,
    });

    sendSuccess(res, updatedEvent, 200, 'Event updated successfully');
  } catch (error: any) {
    if (error.name === 'SequelizeValidationError') {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to update event', 500);
  }
};

// Delete event
export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Prevent deletion of locked events
    if (event.isLocked) {
      sendError(res, 'Cannot delete a locked event', 400);
      return;
    }

    await event.destroy();

    sendSuccess(res, null, 200, 'Event deleted successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete event', 500);
  }
};

// Lock event
export const lockEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const staffId = (req.user as Staff)?.id;

    const event = await Event.findByPk(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.isLocked) {
      sendError(res, 'Event is already locked', 400);
      return;
    }

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    await event.update({
      isLocked: true,
      lockedAt: new Date(),
      lockedByStaffId: staffId,
      lockReason: reason || 'Event locked by staff',
    });

    // Fetch updated event with associations
    const updatedEvent = await Event.findByPk(id, {
      include: [...EVENT_LEADER_INCLUDES, { model: Staff, as: 'lockedBy', attributes: ['id', 'fullName', 'email'] }],
    });

    sendSuccess(res, updatedEvent, 200, 'Event locked successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to lock event', 500);
  }
};

// Unlock event (Admin only)
export const unlockEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = (req.user as Staff)?.id;

    const event = await Event.findByPk(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (!event.isLocked) {
      sendError(res, 'Event is not locked', 400);
      return;
    }

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    await event.update({
      isLocked: false,
      lockedAt: undefined,
      lockedByStaffId: undefined,
      lockReason: undefined,
    });

    // Fetch updated event with associations
    const updatedEvent = await Event.findByPk(id, {
      include: EVENT_LEADER_INCLUDES,
    });

    sendSuccess(res, updatedEvent, 200, 'Event unlocked successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to unlock event', 500);
  }
};

// Get calendar events (for a specific month)
export const getCalendarEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month, semester: semesterParam, academicYear: academicYearParam } = req.query;

    if (!year || !month) {
      sendError(res, 'Year and month are required', 400);
      return;
    }

    const monthNum = Number(month);
    const yearNum = Number(year);
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59);

    // Get semester filter - use provided or fetch from SystemSettings
    let semester: string | undefined = semesterParam as string | undefined;
    let academicYear: number | undefined = academicYearParam ? parseInt(academicYearParam as string, 10) : undefined;

    // If semester not provided, fetch from SystemSettings
    if (!semester || !academicYear) {
      try {
        const semesterSetting = await SystemSettings.findOne({ 
          where: { key: 'current_semester' } 
        });
        if (semesterSetting && semesterSetting.value) {
          const parsed = parseSemester(semesterSetting.value);
          if (parsed) {
            semester = parsed.semester;
            academicYear = parsed.academicYear;
          }
        }
      } catch (err) {
        console.error('Failed to fetch current semester:', err);
      }
    }

    // If semester filter is provided, check if the month belongs to that semester
    if (semester && academicYear) {
      const semesterStr = semester as string;
      const academicYearNum = academicYear;
      
      // Check if the requested month is within the semester range
      let isInSemester = false;
      if (semesterStr === 'Spring' || semesterStr === Semester.SPRING) {
        // Spring: January (1) to May (5)
        isInSemester = monthNum >= 1 && monthNum <= 5 && yearNum === academicYearNum;
      } else if (semesterStr === 'Fall' || semesterStr === Semester.FALL) {
        // Fall: August (8) to December (12)
        isInSemester = monthNum >= 8 && monthNum <= 12 && yearNum === academicYearNum;
      }
      
      // If the month is not in the selected semester, return empty array
      if (!isInSemester) {
        sendSuccess(res, []);
        return;
      }
    }

    const events = await Event.findAll({
      where: {
        startDate: {
          [Op.between]: [startOfMonth, endOfMonth],
        },
      },
      order: [['startDate', 'ASC']],
      include: [
        { model: Staff, as: 'leadOrganizer', attributes: ['id', 'fullName'] },
        { model: Staff, as: 'leadOrganizer2', attributes: ['id', 'fullName'] },
        { model: Staff, as: 'leadOrganizer3', attributes: ['id', 'fullName'] },
      ],
    });

    sendSuccess(res, events);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch calendar events', 500);
  }
};

// Get upcoming events (for dashboard)
export const getUpcomingEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 5;

    const events = await Event.findAll({
      where: {
        startDate: {
          [Op.gte]: new Date(),
        },
      },
      order: [['startDate', 'ASC']],
      limit,
      include: [
        { model: Staff, as: 'leadOrganizer', attributes: ['id', 'fullName'] },
        { model: Staff, as: 'leadOrganizer2', attributes: ['id', 'fullName'] },
        { model: Staff, as: 'leadOrganizer3', attributes: ['id', 'fullName'] },
      ],
    });

    sendSuccess(res, events);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch upcoming events', 500);
  }
};

// Mark event as departed
export const markDeparted = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = (req.user as Staff)?.id;

    const event = await Event.findByPk(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    if (event.departedAt) {
      sendError(res, 'Event has already departed', 400);
      return;
    }

    if (event.attendanceMode !== AttendanceMode.BUS_BASED) {
      sendError(res, 'Only bus-based events can be marked as departed', 400);
      return;
    }

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const departedAt = new Date();

    await event.update({
      departedAt,
      isLocked: true, // Lock after departure
    });

    sendSuccess(res, event, 200, 'Event marked as departed');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark event as departed', 500);
  }
};

