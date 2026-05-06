import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { importStudentFromGoogleForm } from '../controllers/integrations-google-form';
import { rateLimiter } from '../middleware/security';

const router = express.Router();

// POST /api/integrations/google-form/students
router.post(
  '/google-form/students',
  rateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Integration webhook rate limit exceeded. Try again shortly.',
  }),
  asyncHandler(importStudentFromGoogleForm)
);

export default router;
