import { Request, Response } from 'express';
import { Staff, StaffRole } from '../models/Staff';
import { Event } from '../models/Event';
import { Attendance } from '../models/Attendance';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPagination, getSearch } from '../utils/query';
import { Op } from 'sequelize';

// Get all staff members
export const getAllStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const { role } = req.query;

    const where: any = {};
    
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const { count, rows } = await Staff.findAndCountAll({
      where,
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
      order: [['fullName', 'ASC']],
      limit,
      offset,
    });

    sendPaginated(res, rows, { page, limit, total: count });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch staff', 500);
  }
};

// Get single staff member
export const getStaffById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staffId } = req.params;

    const staff = await Staff.findByPk(staffId, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    if (!staff) {
      sendError(res, 'Staff member not found', 404);
      return;
    }

    sendSuccess(res, staff);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch staff member', 500);
  }
};

// Create staff member
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, preferredName, email, nyuEmail, classYear, major, minor, notes, role, position, phone, whatsapp, uaePhone } = req.body;
    const currentUser = req.user;

    // Only admins can create staff members
    if (!currentUser || currentUser.role !== StaffRole.ADMIN) {
      sendError(res, 'Only admins can create staff members', 403);
      return;
    }

    // Check if email already exists
    const existing = await Staff.findOne({ where: { email } });
    if (existing) {
      sendError(res, 'Email already registered', 400);
      return;
    }

    const staff = await Staff.create({
      fullName,
      preferredName,
      email,
      nyuEmail,
      classYear,
      major,
      minor,
      notes,
      role: role === 'admin' ? StaffRole.ADMIN : StaffRole.STAFF,
      position: position || 'GEO',
      phone,
      whatsapp,
      uaePhone,
    });

    const result = await Staff.findByPk(staff.id, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    sendSuccess(res, result);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to create staff member', 500);
  }
};

// Update staff member
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staffId } = req.params;
    const { fullName, preferredName, email, nyuEmail, classYear, major, minor, notes, role, position, phone, whatsapp, uaePhone } = req.body;
    const currentUser = req.user;

    const staff = await Staff.findByPk(staffId);
    if (!staff) {
      sendError(res, 'Staff member not found', 404);
      return;
    }

    // Only admins can update staff members
    if (!currentUser || currentUser.role !== StaffRole.ADMIN) {
      sendError(res, 'Only admins can update staff members', 403);
      return;
    }

    // Prevent changing role to admin if current user is not admin (extra safety)
    if (role === StaffRole.ADMIN && currentUser.role !== StaffRole.ADMIN) {
      sendError(res, 'Only admins can create or update admin accounts', 403);
      return;
    }

    // Check email uniqueness if changed
    if (email && email !== staff.email) {
      const existing = await Staff.findOne({ where: { email } });
      if (existing) {
        sendError(res, 'Email already registered', 400);
        return;
      }
    }

    await staff.update({ fullName, preferredName, email, nyuEmail, classYear, major, minor, notes, role, position, phone, whatsapp, uaePhone });

    const result = await Staff.findByPk(staff.id, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    sendSuccess(res, result);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update staff member', 500);
  }
};

// Delete staff member
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staffId } = req.params;
    const currentUser = req.user;

    // Only admins can delete staff members
    if (!currentUser || currentUser.role !== StaffRole.ADMIN) {
      sendError(res, 'Only admins can delete staff members', 403);
      return;
    }

    const staff = await Staff.findByPk(staffId);
    if (!staff) {
      sendError(res, 'Staff member not found', 404);
      return;
    }

    // Prevent deleting yourself
    if (staffId === currentUser.id) {
      sendError(res, 'You cannot delete your own account', 400);
      return;
    }

    await staff.destroy();

    sendSuccess(res, null);
  } catch (error: any) {
    console.error('Delete staff error:', error);
    sendError(res, error.message || 'Failed to delete staff member', 500);
  }
};

// Get staff activity
export const getStaffActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staffId } = req.params;

    const staff = await Staff.findByPk(staffId, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    if (!staff) {
      sendError(res, 'Staff member not found', 404);
      return;
    }

    const leadSlotWhere = {
      [Op.or]: [
        { leadOrganizerId: staffId },
        { leadOrganizer2Id: staffId },
        { leadOrganizer3Id: staffId },
      ],
    };

    // Get stats
    const eventsOrganized = await Event.count({ where: leadSlotWhere });
    const attendanceMarked = await Attendance.count({ where: { markedByStaffId: staffId } });

    // Get organized events
    const organizedEvents = await Event.findAll({
      where: leadSlotWhere,
      order: [['startDate', 'DESC']],
      limit: 10,
      attributes: ['id', 'name', 'startDate', 'endDate', 'location'],
    });

    sendSuccess(res, {
      staff: staff.get({ plain: true }),
      stats: { eventsOrganized, attendanceMarked },
      organizedEvents: organizedEvents.map(e => e.get({ plain: true })),
      recentActivity: [],
    });
  } catch (error: any) {
    console.error('Error fetching staff activity:', error);
    console.error('Error stack:', error.stack);
    sendError(res, error.message || 'Failed to fetch staff activity', 500);
  }
};

// Get current user profile
export const getCurrentProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 'Not authenticated', 401);
      return;
    }

    const staff = await Staff.findByPk(userId, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    if (!staff) {
      sendError(res, 'Profile not found', 404);
      return;
    }

    const leadSlotWhere = {
      [Op.or]: [
        { leadOrganizerId: userId },
        { leadOrganizer2Id: userId },
        { leadOrganizer3Id: userId },
      ],
    };

    // Get stats
    const eventsOrganized = await Event.count({ where: leadSlotWhere });
    const attendanceMarked = await Attendance.count({ where: { markedByStaffId: userId } });

    sendSuccess(res, {
      ...staff.toJSON(),
      stats: { eventsOrganized, attendanceMarked },
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch profile', 500);
  }
};

// Update current user's own profile
export const updateCurrentProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 'Not authenticated', 401);
      return;
    }

    const { preferredName, phone, whatsapp, uaePhone, nyuEmail, classYear, major, minor, notes } = req.body;
    const staff = await Staff.findByPk(userId);
    
    if (!staff) {
      sendError(res, 'Profile not found', 404);
      return;
    }

    // Users can update their own preferred name, contact info, and student info
    await staff.update({ preferredName, phone, whatsapp, uaePhone, nyuEmail, classYear, major, minor, notes });

    const updated = await Staff.findByPk(userId, {
      attributes: ['id', 'fullName', 'preferredName', 'email', 'nyuEmail', 'classYear', 'major', 'minor', 'notes', 'role', 'position', 'phone', 'whatsapp', 'uaePhone', 'createdAt', 'updatedAt'],
    });

    sendSuccess(res, updated);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update profile', 500);
  }
};