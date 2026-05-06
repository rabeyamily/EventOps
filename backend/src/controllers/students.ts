import { Request, Response } from 'express';
import { Student, StudentStatus, Campus } from '../models/Student';
import { getPagination, getSort, getSearch } from '../utils/query';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { Op } from 'sequelize';

// List students with search/filter/sort in one query path for the table UI.
export const getStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { orderBy, orderDirection } = getSort(req, 'fullName');
    const search = getSearch(req);

    // Build predicates incrementally, then combine once with Op.and.
    const where: any = {};
    const andConditions: any[] = [];

    // Free-text query supports common staff lookup fields.
    if (search) {
      andConditions.push({
        [Op.or]: [
          { fullName: { [Op.iLike]: `%${search}%` } },
          { nyuEmail: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    // Keep campus filtering explicit for NYC/Shanghai operations views.
    if (req.query.campus) {
      andConditions.push({ campus: req.query.campus });
    }

    // Cohort filter checks both fields to support legacy and newer records.
    if (req.query.cohort) {
      const cohortFilter = req.query.cohort as string;
      andConditions.push({
        [Op.or]: [
          { primaryCohort: cohortFilter },
          { cohort: cohortFilter },
        ],
      });
    }

    // Allow filtering by disciplinary status (clear/warned/striked).
    if (req.query.status) {
      andConditions.push({ status: req.query.status });
    }

    // "Missing info" currently targets missing UAE phone data.
    if (req.query.missingInfo === 'true') {
      andConditions.push({
        [Op.or]: [{ uaePhone: null }, { uaePhone: '' }],
      });
    }

    // Only add Op.and when filters exist; empty where means "all students".
    if (andConditions.length > 0) {
      where[Op.and] = andConditions;
    }

    // Find + count keeps pagination metadata and records in sync.
    const { count, rows } = await Student.findAndCountAll({
      where,
      limit,
      offset,
      order: [[orderBy, orderDirection]],
    });

    sendPaginated(res, rows, { page, limit, total: count });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch students', 500);
  }
};

// Get student by ID
export const getStudentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { Staff } = await import('../models');

    const student = await Student.findByPk(id, {
      include: [
        {
          model: Staff,
          as: 'createdBy',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
        {
          model: Staff,
          as: 'updatedBy',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
    });

    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    sendSuccess(res, student);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch student', 500);
  }
};

// Create a student record for the active semester intake.
export const createStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      nyuEmail,
      campus,
      photoUrl,
      uaePhone,
      internationalPhone,
      emergencyContact,
      cohort,
    } = req.body;

    // Audit fields are optional when scripts call this endpoint.
    const currentUser = req.user as any;
    const createdByStaffId = currentUser?.id || null;

    // Same person may appear across semesters, so uniqueness is scoped by cohort.
    const existingStudent = await Student.findOne({ 
      where: { 
        nyuEmail,
        cohort: cohort || null,
      } 
    });
    if (existingStudent) {
      sendError(res, `Student with this email already exists for cohort: ${cohort || 'unspecified'}`, 400);
      return;
    }

    // Initialize with a clear status; model hooks keep status consistent later.
    const student = await Student.create({
      fullName,
      nyuEmail,
      campus: campus as Campus,
      photoUrl,
      uaePhone,
      internationalPhone,
      emergencyContact,
      cohort,
      strikeCount: 0,
      status: StudentStatus.CLEAR,
      createdByStaffId,
      // Mirror creator on insert so both audit columns are populated from day one.
      updatedByStaffId: createdByStaffId,
    });

    sendSuccess(res, student, 201, 'Student created successfully');
  } catch (error: any) {
    if (error.name === 'SequelizeValidationError') {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to create student', 500);
  }
};

// Update student profile fields and preserve audit information.
export const updateStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Capture actor for audit history and admin review.
    const currentUser = req.user as any;
    const updatedByStaffId = currentUser?.id || null;

    const student = await Student.findByPk(id);

    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    // Normalize payload so blank form values do not overwrite meaningful data.
    const cleanUpdateData: any = {};
    
    for (const [key, value] of Object.entries(updateData)) {
      // Skip omitted fields from partial update requests.
      if (value === undefined) continue;
      
      // Ignore empty strings from uncontrolled form submissions.
      if (value === '') {
        continue; // Skip empty strings
      }
      
      // Cast numeric fields defensively when submitted as strings.
      if (key === 'gpa' || key === 'strikeCount') {
        if (typeof value === 'string') {
          const num = key === 'gpa' ? parseFloat(value) : parseInt(value, 10);
          if (!isNaN(num)) {
            cleanUpdateData[key] = num;
          }
        } else if (typeof value === 'number') {
          cleanUpdateData[key] = value;
        }
      } else {
        cleanUpdateData[key] = value;
      }
    }

    // Email collisions are blocked to keep lookups deterministic.
    if (cleanUpdateData.nyuEmail && cleanUpdateData.nyuEmail !== student.nyuEmail) {
      const existingStudent = await Student.findOne({
        where: { nyuEmail: cleanUpdateData.nyuEmail },
      });
      if (existingStudent) {
        sendError(res, 'Student with this email already exists', 400);
        return;
      }
    }

    // Status is derived from strikeCount in model hooks; do not trust client input.
    if ('strikeCount' in cleanUpdateData) {
      delete cleanUpdateData.status;
    }

    // Persist updater ID regardless of which fields changed.
    cleanUpdateData.updatedByStaffId = updatedByStaffId;

    console.log('Updating student with data:', JSON.stringify(cleanUpdateData, null, 2));

    // Apply normalized patch.
    await student.update(cleanUpdateData, { returning: true });

    // Reload ensures response reflects hook-driven or DB-side changes.
    await student.reload();

    console.log('Student updated successfully. New strikeCount:', student.strikeCount, 'New status:', student.status);

    sendSuccess(res, student, 200, 'Student updated successfully');
  } catch (error: any) {
    console.error('Error updating student:', error);
    if (error.name === 'SequelizeValidationError') {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to update student', 500);
  }
};

// Delete student and dependent records in a predictable order.
export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id, {
      include: [
        { model: (await import('../models')).Attendance, as: 'attendances', required: false },
        { model: (await import('../models')).Strike, as: 'strikes', required: false },
      ],
    });

    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    const attendances = (student as any).attendances || [];
    const strikes = (student as any).strikes || [];

    // Remove dependent rows first to avoid foreign-key violations.
    if (attendances.length > 0 || strikes.length > 0) {
      // Explicit deletes keep behavior obvious even if DB cascade rules change.
      if (attendances.length > 0) {
        const { Attendance } = await import('../models');
        await Attendance.destroy({ where: { studentId: id } });
      }
      if (strikes.length > 0) {
        const { Strike } = await import('../models');
        await Strike.destroy({ where: { studentId: id } });
      }
    }

    // Final delete once children are removed.
    await student.destroy();

    sendSuccess(res, null, 200, 'Student deleted successfully');
  } catch (error: any) {
    console.error('Delete student error:', error);
    // Give staff a useful message for common FK failures.
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      sendError(res, 'Cannot delete student: related records exist. Please contact support.', 400);
    } else {
      sendError(res, error.message || 'Failed to delete student', 500);
    }
  }
};

// Focused search endpoint used by quick-search style screens.
export const searchStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);

    if (!search) {
      sendError(res, 'Search query is required', 400);
      return;
    }

    const where: any = {
      [Op.or]: [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { nyuEmail: { [Op.iLike]: `%${search}%` } },
        { cohort: { [Op.iLike]: `%${search}%` } },
      ],
    };

    const { count, rows } = await Student.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fullName', 'ASC']],
    });

    sendPaginated(res, rows, { page, limit, total: count });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to search students', 500);
  }
};

// Get student attendance history
export const getStudentAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { Attendance, Event, Staff } = await import('../models');

    const student = await Student.findByPk(id);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    const attendances = await Attendance.findAll({
      where: { studentId: id },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'startDate', 'location'],
        },
        {
          model: Staff,
          as: 'markedBy',
          attributes: ['id', 'fullName', 'email'],
        },
      ],
      order: [['markedAt', 'DESC']],
    });

    sendSuccess(res, attendances);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch attendance history', 500);
  }
};

// Get student strike history
export const getStudentStrikeHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { Strike, Event, Staff } = await import('../models');

    const student = await Student.findByPk(id);
    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    const strikes = await Strike.findAll({
      where: { studentId: id },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'startDate'],
        },
        {
          model: Staff,
          as: 'excusedBy',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    sendSuccess(res, strikes);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch strike history', 500);
  }
};

