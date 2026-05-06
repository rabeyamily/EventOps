import { Request, Response } from 'express';
import { SystemSettings } from '../models';
import { Semester } from '../models/Event';
import { sendSuccess, sendError } from '../utils/response';
import { parseSemester, formatSemester } from '../utils/semester';

const CURRENT_SEMESTER_KEY = 'current_semester';
const AVAILABLE_SEMESTERS_KEY = 'available_semesters';

function compareSemesterStrings(a: string, b: string): number {
  const pa = parseSemester(a);
  const pb = parseSemester(b);
  if (!pa || !pb) return 0;
  if (pa.academicYear !== pb.academicYear) return pb.academicYear - pa.academicYear; // desc
  return (pb.semester === 'Fall' ? 1 : 0) - (pa.semester === 'Fall' ? 1 : 0); // Fall after Spring
}

function parseAvailableSemestersValue(value: string | null): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((s: unknown) => typeof s === 'string' && /^(Spring|Fall)\s+\d{4}$/.test(s)) : [];
  } catch {
    return [];
  }
}

// Get list of available semesters (admin-managed only; add via Settings)
export const getAvailableSemesters = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [listSetting, currentSetting] = await Promise.all([
      SystemSettings.findOne({ where: { key: AVAILABLE_SEMESTERS_KEY } }),
      SystemSettings.findOne({ where: { key: CURRENT_SEMESTER_KEY } }),
    ]);
    let list: string[] = parseAvailableSemestersValue(listSetting?.value ?? null);
    const current = currentSetting?.value ?? null;
    if (current && !list.includes(current)) {
      list = [current, ...list];
    }
    const sorted = [...list].sort(compareSemesterStrings);
    sendSuccess(res, sorted);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch available semesters', 500);
  }
};

// Add a semester to the admin-managed list (Admin only)
export const addAvailableSemester = async (req: Request, res: Response): Promise<void> => {
  try {
    const { semester, academicYear } = req.body;
    if (!semester || !academicYear) {
      sendError(res, 'Semester and academic year are required', 400);
      return;
    }
    if (!Object.values(Semester).includes(semester)) {
      sendError(res, 'Invalid semester. Must be Spring or Fall', 400);
      return;
    }
    if (typeof academicYear !== 'number' || academicYear < 2000 || academicYear > 2100) {
      sendError(res, 'Invalid academic year', 400);
      return;
    }
    const semesterString = formatSemester(semester, academicYear);
    const [setting] = await SystemSettings.findOrCreate({
      where: { key: AVAILABLE_SEMESTERS_KEY },
      defaults: { key: AVAILABLE_SEMESTERS_KEY, value: '[]', description: 'Admin-managed list of semesters' },
    });
    const list = parseAvailableSemestersValue(setting.value);
    if (!list.includes(semesterString)) {
      list.push(semesterString);
      list.sort(compareSemesterStrings);
      await setting.update({ value: JSON.stringify(list) });
    }
    sendSuccess(res, list);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to add semester', 500);
  }
};

// Get current active semester
export const getCurrentSemester = async (_req: Request, res: Response): Promise<void> => {
  try {
    let setting = await SystemSettings.findOne({ where: { key: CURRENT_SEMESTER_KEY } });
    
    // If no setting exists, determine from current date
    if (!setting) {
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      let semester: Semester;
      let academicYear: number;

      if (month >= 1 && month <= 5) {
        semester = Semester.SPRING;
        academicYear = now.getFullYear();
      } else if (month >= 8 && month <= 12) {
        semester = Semester.FALL;
        academicYear = now.getFullYear();
      } else {
        // June/July - default to Spring of current year
        semester = Semester.SPRING;
        academicYear = now.getFullYear();
      }

      const semesterString = formatSemester(semester, academicYear);
      setting = await SystemSettings.create({
        key: CURRENT_SEMESTER_KEY,
        value: semesterString,
        description: 'Current active semester',
      });
    }

    const parsed = parseSemester(setting.value);
    sendSuccess(res, {
      semester: parsed?.semester || Semester.SPRING,
      academicYear: parsed?.academicYear || new Date().getFullYear(),
      semesterString: setting.value,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch current semester', 500);
  }
};

// Update current active semester (Admin only)
export const updateCurrentSemester = async (req: Request, res: Response): Promise<void> => {
  try {
    const { semester, academicYear } = req.body;

    if (!semester || !academicYear) {
      sendError(res, 'Semester and academic year are required', 400);
      return;
    }

    if (!Object.values(Semester).includes(semester)) {
      sendError(res, 'Invalid semester. Must be Spring or Fall', 400);
      return;
    }

    if (typeof academicYear !== 'number' || academicYear < 2000 || academicYear > 2100) {
      sendError(res, 'Invalid academic year', 400);
      return;
    }

    const semesterString = formatSemester(semester, academicYear);

    const [setting] = await SystemSettings.upsert({
      key: CURRENT_SEMESTER_KEY,
      value: semesterString,
      description: 'Current active semester',
    }, {
      returning: true,
    });

    // Add to admin-managed available semesters if not already there
    const [listRow] = await SystemSettings.findOrCreate({
      where: { key: AVAILABLE_SEMESTERS_KEY },
      defaults: { key: AVAILABLE_SEMESTERS_KEY, value: '[]', description: 'Admin-managed list of semesters' },
    });
    const list = parseAvailableSemestersValue(listRow.value);
    if (!list.includes(semesterString)) {
      list.push(semesterString);
      list.sort(compareSemesterStrings);
      await listRow.update({ value: JSON.stringify(list) });
    }

    sendSuccess(res, {
      semester: setting.value.split(' ')[0],
      academicYear: parseInt(setting.value.split(' ')[1], 10),
      semesterString: setting.value,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update current semester', 500);
  }
};

// Get all system settings
export const getAllSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await SystemSettings.findAll({
      order: [['key', 'ASC']],
    });

    sendSuccess(res, settings);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch settings', 500);
  }
};
