import { Request, Response } from 'express';
import { StaffNote } from '../models/StaffNote';
import { sendSuccess, sendError } from '../utils/response';

export const getMyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const note = await StaffNote.findOne({ where: { staffId } });
    sendSuccess(res, note || { content: '' });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch note', 500);
  }
};

export const saveMyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.user?.id;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { content } = req.body;

    const [note, created] = await StaffNote.findOrCreate({
      where: { staffId },
      defaults: { staffId, content: content || '' },
    });

    if (!created) {
      await note.update({ content: content || '' });
    }

    sendSuccess(res, note);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to save note', 500);
  }
};
