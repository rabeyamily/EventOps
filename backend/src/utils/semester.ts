import { Semester } from '../models/Event';

/**
 * Determines the semester based on a date
 * Spring: January (1) to May (5)
 * Fall: August (8) to December (12)
 * June/July: Defaults to Spring of the same year
 */
export function getSemesterFromDate(date: Date): { semester: Semester; academicYear: number } {
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
  const year = date.getFullYear();

  // Spring: January (1) to May (5)
  if (month >= 1 && month <= 5) {
    return { semester: Semester.SPRING, academicYear: year };
  }

  // Fall: August (8) to December (12)
  if (month >= 8 && month <= 12) {
    return { semester: Semester.FALL, academicYear: year };
  }

  // June/July: Default to Spring of the same year
  // (These months are typically between semesters)
  if (month >= 6 && month <= 7) {
    return { semester: Semester.SPRING, academicYear: year };
  }

  // Fallback (shouldn't happen, but just in case)
  return { semester: Semester.SPRING, academicYear: year };
}

/**
 * Formats semester and year as a string (e.g., "Spring 2026")
 */
export function formatSemester(semester: Semester, academicYear: number): string {
  return `${semester} ${academicYear}`;
}

/**
 * Parses a semester string (e.g., "Spring 2026") into semester and year
 */
export function parseSemester(semesterString: string): { semester: Semester; academicYear: number } | null {
  const match = semesterString.match(/^(Spring|Fall)\s+(\d{4})$/);
  if (!match) {
    return null;
  }
  return {
    semester: match[1] as Semester,
    academicYear: parseInt(match[2], 10),
  };
}
