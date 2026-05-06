import { Request, Response } from 'express';
import { Staff, StaffRole } from '../models/Staff';
import { sendSuccess, sendError } from '../utils/response';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export const importStaffCSVMiddleware = csvUpload.single('csv');

function normHeader(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCell(row: Record<string, string>, ...candidates: string[]): string | undefined {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) {
    const raw = row[key];
    const v = raw == null ? '' : String(raw).trim();
    map.set(normHeader(key), v);
  }
  for (const c of candidates) {
    const v = map.get(normHeader(c));
    if (v) return v;
  }
  return undefined;
}

export const importStaffFromCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No CSV file uploaded', 400);
      return;
    }

    const currentUser = req.user as { id?: string; role?: string } | undefined;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can import staff', 403);
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];

    const results = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const fullName =
        getCell(row, 'Full Name', 'Full name', 'Name', 'fullName') ||
        [getCell(row, 'First', 'first'), getCell(row, 'Last', 'last')]
          .filter(Boolean)
          .join(' ')
          .trim();
      const email = getCell(row, 'Email', 'email');
      if (!email) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: Missing email`);
        continue;
      }
      if (!fullName) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: Missing name`);
        continue;
      }

      const nyuEmail = getCell(row, 'NYU Email', 'nyuEmail', 'NYU email');
      const position = getCell(row, 'Position', 'position') || 'GEO';
      const phone = getCell(row, 'Phone', 'phone', 'Phone (Other)');
      const whatsapp = getCell(row, 'WhatsApp', 'whatsapp');
      const uaePhone = getCell(row, 'UAE Phone', 'uaePhone', 'UAE phone');
      const preferredName = getCell(row, 'Preferred Name', 'Preferred', 'preferredName');
      const classYear = getCell(row, 'Class Year', 'classYear');
      const major = getCell(row, 'Major', 'major');
      const roleRaw = (getCell(row, 'Role', 'role') || 'staff').toLowerCase();
      const role = roleRaw === 'admin' ? StaffRole.ADMIN : StaffRole.STAFF;

      try {
        const existing = await Staff.findOne({ where: { email: email.toLowerCase() } });
        if (existing) {
          await existing.update({
            fullName,
            preferredName: preferredName || existing.preferredName,
            nyuEmail: nyuEmail || existing.nyuEmail,
            position,
            phone: phone || existing.phone,
            whatsapp: whatsapp || existing.whatsapp,
            uaePhone: uaePhone || existing.uaePhone,
            classYear: classYear || existing.classYear,
            major: major || existing.major,
            role,
          });
          results.updated++;
        } else {
          await Staff.create({
            fullName,
            preferredName,
            email: email.toLowerCase(),
            nyuEmail,
            classYear,
            major,
            role,
            position,
            phone,
            whatsapp,
            uaePhone,
          });
          results.created++;
        }
      } catch (err: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 2} (${email}): ${err.message}`);
      }
    }

    sendSuccess(res, results, 200, 'Staff CSV import completed');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to import staff CSV', 500);
  }
};
