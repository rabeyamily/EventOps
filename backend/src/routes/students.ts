import express from 'express';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  searchStudents,
  getStudentAttendanceHistory,
  getStudentStrikeHistory,
} from '../controllers/students';
import { uploadPhoto, uploadPhotoMiddleware, deletePhoto } from '../controllers/students-photo';
import {
  importStudentsFromCSV,
  importCSVMiddleware,
  importStudentsFromGoogleSheet,
} from '../controllers/students-import';

const router = express.Router();

// Validation schemas
const createStudentSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    nyuEmail: z.string().email('Invalid email format'),
    campus: z.enum(['NYC', 'Shanghai']),
    photoUrl: z.string().url().optional(),
    uaePhone: z.string().optional(),
    internationalPhone: z.string().optional(),
    emergencyContact: z.string().optional(),
    cohort: z.string().optional(),
  }),
});

const updateStudentSchema = z.object({
  body: z.object({}).passthrough(), // Allow any fields, validation happens in controller
  params: z.object({
    id: z.string().uuid('Invalid student ID'),
  }),
});

const searchSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    campus: z.enum(['NYC', 'Shanghai']).optional(),
    cohort: z.string().optional(),
    status: z.enum(['clear', 'one_strike', 'blocked']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const importGoogleSheetSchema = z.object({
  body: z.object({
    semester: z.string().min(1, 'semester is required'),
    sheetCsvUrl: z.string().url().optional(),
  }),
});

// All routes require authentication
router.use(requireAuth);

// GET /api/students - List all students with pagination and filters
router.get('/', validate(searchSchema), asyncHandler(getStudents));

// GET /api/students/search - Search students
router.get('/search', validate(searchSchema), asyncHandler(searchStudents));

// GET /api/students/:id - Get student by ID
router.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(getStudentById)
);

// GET /api/students/:id/attendance - Get student attendance history
router.get(
  '/:id/attendance',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(getStudentAttendanceHistory)
);

// GET /api/students/:id/strikes - Get student strike history
router.get(
  '/:id/strikes',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(getStudentStrikeHistory)
);

// POST /api/students - Create new student (Admin only)
router.post(
  '/',
  requireAdmin,
  validate(createStudentSchema),
  asyncHandler(createStudent)
);

// PUT /api/students/:id - Update student (GEO and Admin)
router.put(
  '/:id',
  requireAuth, // Allow both GEO and Admin
  validate(updateStudentSchema),
  asyncHandler(updateStudent)
);

// DELETE /api/students/:id - Delete student (Admin only)
router.delete(
  '/:id',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(deleteStudent)
);

// POST /api/students/:id/photo - Upload student photo (Admin only)
router.post(
  '/:id/photo',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  uploadPhotoMiddleware,
  asyncHandler(uploadPhoto)
);

// DELETE /api/students/:id/photo - Delete student photo (Admin only)
router.delete(
  '/:id/photo',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(deletePhoto)
);

// POST /api/students/import - Import students from CSV (Admin only)
router.post(
  '/import',
  requireAdmin,
  importCSVMiddleware,
  asyncHandler(importStudentsFromCSV)
);

// POST /api/students/import/google-sheet - Import students from Google Sheet for a selected semester
router.post(
  '/import/google-sheet',
  requireAdmin,
  validate(importGoogleSheetSchema),
  asyncHandler(importStudentsFromGoogleSheet)
);

export default router;
