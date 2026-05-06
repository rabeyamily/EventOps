import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Student } from '../models/Student';
import { sendSuccess, sendError } from '../utils/response';
// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads/students';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const { id } = req.params;
    const ext = path.extname(file.originalname);
    const filename = `student-${id}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
});

// Upload student photo middleware
export const uploadPhotoMiddleware = upload.single('photo');

// Upload student photo
export const uploadPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id);

    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded', 400);
      return;
    }

    // Delete old photo if exists
    if (student.photoUrl) {
      const oldPhotoPath = path.join(uploadDir, path.basename(student.photoUrl));
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update student with new photo URL
    // In production, you'd upload to S3/Cloudinary and store the URL
    const photoUrl = `/uploads/students/${req.file.filename}`;
    await student.update({ photoUrl });

    sendSuccess(res, { photoUrl }, 200, 'Photo uploaded successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to upload photo', 500);
  }
};

// Delete student photo
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id);

    if (!student) {
      sendError(res, 'Student not found', 404);
      return;
    }

    if (!student.photoUrl) {
      sendError(res, 'Student has no photo', 400);
      return;
    }

    // Delete photo file
    const photoPath = path.join(uploadDir, path.basename(student.photoUrl));
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }

    // Update student
    await student.update({ photoUrl: undefined });

    sendSuccess(res, null, 200, 'Photo deleted successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete photo', 500);
  }
};

