import { Request, Response } from 'express';
import { PersonalAgenda } from '../models/PersonalAgenda';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

// Validation schemas
const createAgendaItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.union([z.string().datetime(), z.string()]).optional().transform((val) => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
});

const updateAgendaItemSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  dueDate: z.union([z.string().datetime(), z.string()]).optional().transform((val) => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
});

// Get all agenda items for current user
export const getPersonalAgenda = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { completed } = req.query;
    const where: any = { staffId };
    
    if (completed !== undefined) {
      where.completed = completed === 'true';
    }

    const agendaItems = await PersonalAgenda.findAll({
      where,
      order: [
        ['completed', 'ASC'],
        ['dueDate', 'ASC'],
        ['priority', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    sendSuccess(res, agendaItems);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch personal agenda', 500);
  }
};

// Create a new agenda item
export const createAgendaItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const validatedData = createAgendaItemSchema.parse(req.body);
    
    const agendaItem = await PersonalAgenda.create({
      ...validatedData,
      staffId,
      completed: false,
    });

    sendSuccess(res, agendaItem, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to create agenda item', 500);
  }
};

// Update an agenda item
export const updateAgendaItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { id } = req.params;
    const agendaItem = await PersonalAgenda.findOne({
      where: { id, staffId },
    });

    if (!agendaItem) {
      sendError(res, 'Agenda item not found', 404);
      return;
    }

    const validatedData = updateAgendaItemSchema.parse(req.body);
    await agendaItem.update(validatedData);

    sendSuccess(res, agendaItem);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    sendError(res, error.message || 'Failed to update agenda item', 500);
  }
};

// Delete an agenda item
export const deleteAgendaItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { id } = req.params;
    const agendaItem = await PersonalAgenda.findOne({
      where: { id, staffId },
    });

    if (!agendaItem) {
      sendError(res, 'Agenda item not found', 404);
      return;
    }

    await agendaItem.destroy();
    sendSuccess(res, { message: 'Agenda item deleted successfully' });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete agenda item', 500);
  }
};
