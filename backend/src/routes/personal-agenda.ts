import express from 'express';
import { requireAuth } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import {
  getPersonalAgenda,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
} from '../controllers/personal-agenda';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/personal-agenda - Get all agenda items for current user
router.get(
  '/',
  validate(z.object({
    query: z.object({
      completed: z.string().optional(),
    }).optional(),
  })),
  asyncHandler(getPersonalAgenda)
);

// POST /api/personal-agenda - Create a new agenda item
router.post(
  '/',
  validate(z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      tags: z.array(z.string()).optional(),
      color: z.string().optional(),
    }),
  })),
  asyncHandler(createAgendaItem)
);

// PUT /api/personal-agenda/:id - Update an agenda item
router.put(
  '/:id',
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      completed: z.boolean().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      tags: z.array(z.string()).optional(),
      color: z.string().optional(),
    }),
  })),
  asyncHandler(updateAgendaItem)
);

// DELETE /api/personal-agenda/:id - Delete an agenda item
router.delete(
  '/:id',
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
  })),
  asyncHandler(deleteAgendaItem)
);

export default router;
