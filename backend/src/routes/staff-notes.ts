import express from 'express';
import { requireAuth } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { getMyNote, saveMyNote } from '../controllers/staff-notes';

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(getMyNote));

router.put(
  '/',
  validate(z.object({
    body: z.object({
      content: z.string(),
    }),
  })),
  asyncHandler(saveMyNote)
);

export default router;
