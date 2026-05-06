import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Attendance, AttendanceSheet, Event } from '../models';
import { Staff } from '../models/Staff';
import { sendSuccess, sendError } from '../utils/response';

// Add a new bus (creates 2 default sheets: Before Departure, Before Return)
export const addBus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Verify event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Find the highest bus number for this event
    const existingSheets = await AttendanceSheet.findAll({
      where: { eventId },
      attributes: ['busNumber'],
    });

    // Extract bus numbers and find the highest
    const busNumbers = existingSheets
      .map(s => {
        const match = s.busNumber.match(/Bus (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    
    const nextBusNumber = busNumbers.length > 0 ? Math.max(...busNumbers) + 1 : 1;
    const busName = `Bus ${nextBusNumber}`;

    // Create the two default sheets for this bus
    await AttendanceSheet.create({
      eventId,
      name: 'Before Departure',
      busNumber: busName,
      createdByStaffId: staffId,
      isActive: false,
    });

    await AttendanceSheet.create({
      eventId,
      name: 'Before Return',
      busNumber: busName,
      createdByStaffId: staffId,
      isActive: false,
    });

    // Fetch with associations
    const sheets = await AttendanceSheet.findAll({
      where: { eventId, busNumber: busName },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'createdBy', attributes: ['id', 'fullName', 'email'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    sendSuccess(res, { busNumber: busName, sheets }, 201, `${busName} added with default sheets`);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to add bus', 500);
  }
};

// Create a new attendance sheet (for adding custom sheets to a bus)
export const createAttendanceSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { name, busNumber } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!name || !busNumber) {
      sendError(res, 'Name and bus number are required', 400);
      return;
    }

    // Verify event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    // Create the sheet
    const sheet = await AttendanceSheet.create({
      eventId,
      name,
      busNumber,
      createdByStaffId: staffId,
      isActive: false, // Will be set active separately
    });

    // Fetch with associations
    const createdSheet = await AttendanceSheet.findByPk(sheet.id, {
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'createdBy', attributes: ['id', 'fullName', 'email'] },
      ],
    });

    sendSuccess(res, createdSheet, 201, 'Attendance sheet created successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to create attendance sheet', 500);
  }
};

// Delete a bus and all its sheets
export const deleteBus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, busNumber } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const decodedBusNumber = decodeURIComponent(busNumber);

    // Delete all sheets for this bus, and also delete their attendance records.
    // Otherwise the event summaries still show present/absent from the old attendance rows.
    const sheets = await AttendanceSheet.findAll({
      where: { eventId, busNumber: decodedBusNumber },
      attributes: ['id'],
      raw: true,
    });

    const sheetIds = sheets.map((s: any) => s.id);

    if (sheetIds.length > 0) {
      // Also delete "orphaned" present/absent rows created without a sheet
      // (attendanceSheetId == NULL). We intentionally do NOT delete
      // not_marked rows because those represent assignments.
      const whereClause: any = {
        eventId,
        [Op.or]: [
          { attendanceSheetId: sheetIds },
          // attendanceSheetId can be NULL for orphaned marks created outside a sheet context.
          { attendanceSheetId: { [Op.is]: null }, status: ['present', 'absent'] },
        ],
      };

      await Attendance.destroy({ where: whereClause });
    }

    const deletedCount = await AttendanceSheet.destroy({
      where: { eventId, busNumber: decodedBusNumber },
    });

    sendSuccess(
      res,
      { deletedCount },
      200,
      `${decodedBusNumber} and all its sheets (and their attendance) deleted`
    );
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete bus', 500);
  }
};

// Delete a single attendance sheet
export const deleteSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sheetId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const sheet = await AttendanceSheet.findByPk(sheetId);
    if (!sheet) {
      sendError(res, 'Attendance sheet not found', 404);
      return;
    }

    // Delete attendances attached to this sheet first (so counts/summaries are accurate).
    const whereClause: any = {
      eventId: sheet.eventId,
      [Op.or]: [
        { attendanceSheetId: sheet.id },
        { attendanceSheetId: { [Op.is]: null }, status: ['present', 'absent'] },
      ],
    };

    await Attendance.destroy({ where: whereClause });

    // Delete the sheet itself
    await sheet.destroy();

    sendSuccess(res, { deleted: true }, 200, 'Attendance sheet deleted successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete attendance sheet', 500);
  }
};

// Get all attendance sheets for an event
export const getEventAttendanceSheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const sheets = await AttendanceSheet.findAll({
      where: { eventId },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'createdBy', attributes: ['id', 'fullName', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    sendSuccess(res, sheets);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch attendance sheets', 500);
  }
};

// Set a sheet as active (and deactivate others)
export const setActiveSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sheetId } = req.params;
    const staffId = req.user?.id;

    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const sheet = await AttendanceSheet.findByPk(sheetId, {
      include: [{ model: Event, as: 'event' }],
    });

    if (!sheet) {
      sendError(res, 'Attendance sheet not found', 404);
      return;
    }

    // Deactivate all other sheets for this event
    await AttendanceSheet.update(
      { isActive: false },
      { where: { eventId: sheet.eventId, id: { [Op.ne]: sheetId } } }
    );

    // Activate this sheet
    await sheet.update({ isActive: true });

    // Fetch with associations
    const updatedSheet = await AttendanceSheet.findByPk(sheetId, {
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'createdBy', attributes: ['id', 'fullName', 'email'] },
      ],
    });

    sendSuccess(res, updatedSheet, 200, 'Attendance sheet activated');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to set active sheet', 500);
  }
};

// Get active sheet for an event
export const getActiveSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const sheet = await AttendanceSheet.findOne({
      where: { eventId, isActive: true },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'name', 'startDate'] },
        { model: Staff, as: 'createdBy', attributes: ['id', 'fullName', 'email'] },
      ],
    });

    sendSuccess(res, sheet || null);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch active sheet', 500);
  }
};
