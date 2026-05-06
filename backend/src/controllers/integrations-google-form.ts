import { Request, Response } from 'express';
import { z } from 'zod';
import { Campus, Student, StudentStatus } from '../models/Student';
import { Semester } from '../models/Event';
import { SystemSettings } from '../models/SystemSettings';
import { formatSemester } from '../utils/semester';
import { sendError, sendSuccess } from '../utils/response';

const googleFormPayloadSchema = z.object({
  fullName: z.string().min(1, 'fullName is required'),
  nyuEmail: z.string().email('nyuEmail must be a valid email'),
  campus: z.enum(['NYC', 'Shanghai']).optional(),
  preferredName: z.string().optional(),
  uaePhone: z.string().optional(),
  internationalPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  altEmergencyContact: z.string().optional(),
  cohort: z.string().optional(),
  nNumber: z.string().optional(),
  school: z.string().optional(),
  major: z.string().optional(),
  academicLevel: z.string().optional(),
  admitTerm: z.string().optional(),
  citizenship: z.string().optional(),
  passportCountry: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  passportUrl: z.string().url().optional(),
  immigrationFormUrl: z.string().url().optional(),
});

const cleanOptionalString = (value?: string): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getCurrentCohort = async (): Promise<string> => {
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();
  const derivedCohort =
    nowMonth >= 8 && nowMonth <= 12
      ? formatSemester(Semester.FALL, nowYear)
      : formatSemester(Semester.SPRING, nowYear);

  try {
    const semesterSetting = await SystemSettings.findOne({
      where: { key: 'current_semester' },
    });
    if (semesterSetting?.value) {
      return semesterSetting.value;
    }
  } catch (error) {
    console.error('Failed to resolve current semester setting:', error);
  }

  return derivedCohort;
};

export const importStudentFromGoogleForm = async (req: Request, res: Response): Promise<void> => {
  const expectedSecret = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  const providedSecret = req.header('x-webhook-secret');

  if (!expectedSecret) {
    sendError(res, 'Integration is not configured on server', 500);
    return;
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    sendError(res, 'Invalid webhook secret', 401);
    return;
  }

  const parsed = googleFormPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(', ');
    sendError(res, message || 'Invalid payload', 400);
    return;
  }

  try {
    const payload = parsed.data;
    const nyuEmail = payload.nyuEmail.trim().toLowerCase();
    const fallbackCohort = await getCurrentCohort();
    const cohortToApply = cleanOptionalString(payload.cohort) || fallbackCohort;

    const studentData = {
      fullName: payload.fullName.trim(),
      nyuEmail,
      campus: (payload.campus || Campus.NYC) as Campus,
      preferredName: cleanOptionalString(payload.preferredName),
      uaePhone: cleanOptionalString(payload.uaePhone),
      internationalPhone: cleanOptionalString(payload.internationalPhone),
      emergencyContact: cleanOptionalString(payload.emergencyContact),
      altEmergencyContact: cleanOptionalString(payload.altEmergencyContact),
      nNumber: cleanOptionalString(payload.nNumber),
      school: cleanOptionalString(payload.school),
      major: cleanOptionalString(payload.major),
      academicLevel: cleanOptionalString(payload.academicLevel),
      admitTerm: cleanOptionalString(payload.admitTerm),
      citizenship: cleanOptionalString(payload.citizenship),
      passportCountry: cleanOptionalString(payload.passportCountry),
      gender: cleanOptionalString(payload.gender),
      address: cleanOptionalString(payload.address),
    };

    const existingStudent = await Student.findOne({
      where: { nyuEmail },
    });

    if (existingStudent) {
      const existingCohorts = existingStudent.cohort
        ? existingStudent.cohort.split(',').map((cohort) => cohort.trim())
        : [];
      if (!existingCohorts.includes(cohortToApply)) {
        existingCohorts.push(cohortToApply);
      }

      await existingStudent.update({
        ...studentData,
        cohort: existingCohorts.join(', '),
        primaryCohort: cohortToApply,
      });

      console.log(`[google-form-webhook] updated student ${nyuEmail}`);
      sendSuccess(
        res,
        {
          action: 'updated',
          studentId: existingStudent.id,
          nyuEmail,
          cohort: cohortToApply,
          receivedDocuments: {
            passportUrl: !!payload.passportUrl,
            immigrationFormUrl: !!payload.immigrationFormUrl,
          },
        },
        200,
        'Student updated from Google Form'
      );
      return;
    }

    const created = await Student.create({
      ...studentData,
      cohort: cohortToApply,
      primaryCohort: cohortToApply,
      strikeCount: 0,
      status: StudentStatus.CLEAR,
    });

    console.log(`[google-form-webhook] created student ${nyuEmail}`);
    sendSuccess(
      res,
      {
        action: 'created',
        studentId: created.id,
        nyuEmail,
        cohort: cohortToApply,
        receivedDocuments: {
          passportUrl: !!payload.passportUrl,
          immigrationFormUrl: !!payload.immigrationFormUrl,
        },
      },
      201,
      'Student created from Google Form'
    );
  } catch (error: any) {
    console.error('[google-form-webhook] import failed:', error);
    sendError(res, error.message || 'Failed to import student from Google Form', 500);
  }
};
