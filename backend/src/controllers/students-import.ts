import { Request, Response } from 'express';
import { Student, Campus, StudentStatus } from '../models/Student';
import { SystemSettings } from '../models/SystemSettings';
import { sendSuccess, sendError } from '../utils/response';
import { formatSemester } from '../utils/semester';
import { Semester } from '../models/Event';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

// Configure multer for CSV uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export const importCSVMiddleware = csvUpload.single('csv');

interface CSVRow {
  Last: string;
  First: string;
  Preferred?: string;
  'N Number': string;
  Email: string;
  'Date Approved'?: string;
  'Application Status'?: string;
  'Admit Term at NYU AD'?: string;
  'Accepted Program'?: string;
  School?: string;
  Major?: string;
  'Academic Level'?: string;
  GPA?: string;
  'Passport Upload'?: string;
  'Immigration Form'?: string;
  'Primary Passport Last Name'?: string;
  'Primary Passport First Name'?: string;
  'Primary Passport Country (Country of Citizenship)'?: string;
  'Primary Passport Issuing Authority'?: string;
  'Primary Passport Number'?: string;
  'Primary Passport Validity Date'?: string;
  'Primary Passport Expiration Date'?: string;
  'Sex in Passport'?: string;
  'Legal Sex'?: string;
  'Country of Previous Nationality'?: string;
  'Languages Spoken'?: string;
  Religion?: string;
  'Religious Sect'?: string;
  'Health Insurance Provider'?: string;
  Birthdate?: string;
  'City of Birth'?: string;
  'State or Province of Birth'?: string;
  'Country of Birth'?: string;
  "Father's First Name"?: string;
  "Father's Middle Name"?: string;
  "Father's Last Name"?: string;
  "Mother's First Name"?: string;
  "Mother's Middle Name"?: string;
  "Mother's Last Name"?: string;
  'Gender Identity'?: string;
  'Secondary Passport Last Name'?: string;
  'Secondary Passport First Name'?: string;
  'Secondary Passport Country'?: string;
  'Secondary Passport Number'?: string;
  'Secondary Passport Validity Date'?: string;
  'Secondary Passport Expiration Date'?: string;
  'Marital Status'?: string;
  Address?: string;
  Race?: string;
  'Housing Exemption Status'?: string;
  'Emergency Contact Type'?: string;
  'Emergency Contact Name'?: string;
  'Emergency Contact Phone'?: string;
  'Emergency Contact Email'?: string;
  'Alt Emergency Contact Type'?: string;
  'Alt Emergency Contact Name'?: string;
  'Alt Emergency Contact Phone'?: string;
  'Alt Emergency Contact Email'?: string;
  'Geoblue Certificate Number'?: string;
  'Geoblue Coverage Valid From Date'?: string;
  'Geoblue Coverage Valid Through Date'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Email Address'?: string;
}

// Helper to parse date in DD/MM/YYYY format
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

// Helper to parse GPA
function parseGPA(gpaStr: string | undefined): number | undefined {
  if (!gpaStr) return undefined;
  const gpa = parseFloat(gpaStr);
  if (!isNaN(gpa) && gpa >= 0 && gpa <= 4) {
    return gpa;
  }
  return undefined;
}

function normalizeValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRowField(row: CSVRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalizeValue((row as any)[key]);
    if (value) return value;
  }
  return undefined;
}

function getGoogleSheetCsvUrlForSemester(semester: string): string | undefined {
  const mappingJson = normalizeValue(process.env.GOOGLE_FORM_SHEET_CSV_URLS_JSON);
  if (!mappingJson) return undefined;

  try {
    const parsed = JSON.parse(mappingJson) as Record<string, string>;
    const matched = parsed[semester];
    return normalizeValue(matched);
  } catch (error) {
    console.error('Invalid GOOGLE_FORM_SHEET_CSV_URLS_JSON value. Expected JSON object:', error);
    return undefined;
  }
}

async function getDefaultCohort(): Promise<string> {
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();
  const derivedCohort = nowMonth >= 8 && nowMonth <= 12
    ? formatSemester(Semester.FALL, nowYear)
    : formatSemester(Semester.SPRING, nowYear);

  try {
    const semesterSetting = await SystemSettings.findOne({
      where: { key: 'current_semester' },
    });
    if (semesterSetting && semesterSetting.value) {
      return semesterSetting.value;
    }
  } catch (err) {
    console.error('Failed to fetch current semester, using date-derived value:', err);
  }

  return derivedCohort;
}

async function importStudentRecords(
  records: CSVRow[],
  cohort: string,
  staffId?: string
): Promise<{ total: number; created: number; updated: number; skipped: number; errors: string[] }> {
  const results = {
    total: records.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      const firstName = getRowField(row, ['First', 'First Name']);
      const lastName = getRowField(row, ['Last', 'Last Name']);
      const email = getRowField(row, ['Email', 'Email Address']);

      if (!row || !email || !firstName || !lastName) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: Skipped - Missing required fields (Email, First, or Last)`);
        continue;
      }

      if (!email.includes('@') || !email.includes('.')) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: Skipped - Invalid email format: ${email}`);
        continue;
      }

      let campus: Campus = Campus.NYC;
      const schoolField = row.School || '';
      if (schoolField.toLowerCase().includes('shanghai')) {
        campus = Campus.SHANGHAI;
      }

      const fullName = `${firstName} ${lastName}`.trim();
      const preferredName = row.Preferred && row.Preferred !== firstName ? row.Preferred : undefined;

      let emergencyContact: string | undefined;
      if (row['Emergency Contact Name']) {
        const parts = [row['Emergency Contact Name']];
        if (row['Emergency Contact Type']) {
          parts.unshift(`[${row['Emergency Contact Type']}]`);
        }
        if (row['Emergency Contact Phone'] && row['Emergency Contact Phone'] !== '#ERROR!') {
          parts.push(`Phone: ${row['Emergency Contact Phone']}`);
        }
        if (row['Emergency Contact Email']) {
          parts.push(`Email: ${row['Emergency Contact Email']}`);
        }
        emergencyContact = parts.join(' | ');
      }

      let altEmergencyContact: string | undefined;
      if (row['Alt Emergency Contact Name']) {
        const parts = [row['Alt Emergency Contact Name']];
        if (row['Alt Emergency Contact Type']) {
          parts.unshift(`[${row['Alt Emergency Contact Type']}]`);
        }
        if (row['Alt Emergency Contact Phone'] && row['Alt Emergency Contact Phone'] !== '#ERROR!') {
          parts.push(`Phone: ${row['Alt Emergency Contact Phone']}`);
        }
        if (row['Alt Emergency Contact Email']) {
          parts.push(`Email: ${row['Alt Emergency Contact Email']}`);
        }
        altEmergencyContact = parts.join(' | ');
      }

      const gpa = parseGPA(row.GPA);
      const birthdate = parseDate(row.Birthdate);
      const gender = row['Gender Identity'] || row['Legal Sex'] || undefined;

      let address = row.Address;
      if (address) {
        address = address.replace(/\s+/g, ' ').trim();
      }

      const studentData = {
        fullName,
        preferredName,
        nyuEmail: email,
        nNumber: row['N Number'] || undefined,
        campus,
        school: row.School || undefined,
        major: row.Major || undefined,
        academicLevel: row['Academic Level'] || undefined,
        gpa,
        admitTerm: row['Admit Term at NYU AD'] || undefined,
        birthdate,
        citizenship: row['Primary Passport Country (Country of Citizenship)'] || undefined,
        passportCountry: row['Primary Passport Country (Country of Citizenship)'] || undefined,
        gender: gender || row['Sex in Passport'] || row['Legal Sex'] || undefined,
        address,
        emergencyContact,
        altEmergencyContact,
        cohort,
      };

      const existingStudent = await Student.findOne({
        where: { nyuEmail: email },
      });

      if (existingStudent) {
        const existingCohorts = existingStudent.cohort ? existingStudent.cohort.split(',').map((c) => c.trim()) : [];
        if (!existingCohorts.includes(cohort)) {
          existingCohorts.push(cohort);
        }

        await existingStudent.update({
          ...studentData,
          cohort: existingCohorts.join(', '),
          primaryCohort: cohort,
          updatedByStaffId: staffId || null,
          strikeCount: existingStudent.strikeCount,
          status: existingStudent.status,
        });
        results.updated++;
      } else {
        await Student.create({
          ...studentData,
          cohort,
          primaryCohort: cohort,
          strikeCount: 0,
          status: StudentStatus.CLEAR,
          createdByStaffId: staffId || null,
          updatedByStaffId: staffId || null,
        });
        results.created++;
      }
    } catch (error: any) {
      const firstName = getRowField(row, ['First', 'First Name']) || 'Unknown';
      const lastName = getRowField(row, ['Last', 'Last Name']) || 'Unknown';
      results.skipped++;
      results.errors.push(`Error processing ${firstName} ${lastName}: ${error.message}`);
    }
  }

  return results;
}

// Parse CSV and import students
export const importStudentsFromCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No CSV file uploaded', 400);
      return;
    }

    const staffId = (req.user as any)?.id as string | undefined;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const cohort = await getDefaultCohort();

    // Parse CSV with options to handle multi-line fields
    const csvContent = req.file.buffer.toString('utf-8');
    const records: CSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
      bom: true, // Handle BOM if present
      skip_records_with_error: false, // Don't skip records with errors, log them instead
    });

    const results = await importStudentRecords(records, cohort, staffId);

    sendSuccess(res, results, 200, 'CSV import completed');
  } catch (error: any) {
    console.error('CSV Import Error:', error);
    sendError(res, error.message || 'Failed to import CSV', 500);
  }
};

// Import students from Google Sheet CSV URL, filtered by selected semester
export const importStudentsFromGoogleSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = (req.user as any)?.id as string | undefined;
    if (!staffId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const selectedSemester = normalizeValue(req.body?.semester);
    const semesterMappedCsvUrl = getGoogleSheetCsvUrlForSemester(selectedSemester);
    const configuredCsvUrl = normalizeValue(process.env.GOOGLE_FORM_SHEET_CSV_URL);
    const overrideCsvUrl = normalizeValue(req.body?.sheetCsvUrl);
    const csvUrl = overrideCsvUrl || semesterMappedCsvUrl || configuredCsvUrl;

    if (!selectedSemester) {
      sendError(res, 'Semester is required', 400);
      return;
    }

    if (!csvUrl) {
      sendError(
        res,
        'Google Sheet CSV URL is not configured. Set GOOGLE_FORM_SHEET_CSV_URL in environment.',
        500
      );
      return;
    }

    const response = await fetch(csvUrl);
    if (!response.ok) {
      sendError(res, `Failed to fetch Google Sheet CSV (status ${response.status})`, 502);
      return;
    }

    const csvContent = await response.text();
    const allRecords: CSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
      bom: true,
      skip_records_with_error: false,
    });

    const semesterRecords = allRecords.filter((row) => {
      const admitTerm = normalizeValue(row['Admit Term at NYU AD']);
      return admitTerm === selectedSemester;
    });

    const results = await importStudentRecords(semesterRecords, selectedSemester, staffId);
    sendSuccess(
      res,
      {
        ...results,
        selectedSemester,
        sourceRows: allRecords.length,
        importedRows: semesterRecords.length,
      },
      200,
      `Google Sheet import completed for ${selectedSemester}`
    );
  } catch (error: any) {
    console.error('Google Sheet import error:', error);
    sendError(res, error.message || 'Failed to import students from Google Sheet', 500);
  }
};

