import { Student, StudentStatus } from '../models/Student';

/**
 * Calculate student status based on strike count
 * - 0 strikes = CLEAR
 * - 1 strike = ONE_STRIKE
 * - 2+ strikes = BLOCKED
 */
export function calculateStudentStatus(strikeCount: number): StudentStatus {
  if (strikeCount === 0) {
    return StudentStatus.CLEAR;
  } else if (strikeCount === 1) {
    return StudentStatus.ONE_STRIKE;
  } else {
    return StudentStatus.BLOCKED;
  }
}

/**
 * Update student status based on current strike count
 * This should be called whenever strikes are added/removed/excused
 */
export async function updateStudentStatus(studentId: string): Promise<void> {
  const { Strike } = await import('../models');
  const student = await Student.findByPk(studentId);
  
  if (!student) {
    throw new Error('Student not found');
  }

  // Count active (non-excused) strikes
  const activeStrikes = await Strike.count({
    where: {
      studentId,
      isExcused: false,
    },
  });

  // Update strike count and status
  const newStatus = calculateStudentStatus(activeStrikes);
  await student.update({
    strikeCount: activeStrikes,
    status: newStatus,
  });
}

/**
 * Recalculate status for all students (useful for maintenance)
 */
export async function recalculateAllStudentStatuses(): Promise<void> {
  const { Strike } = await import('../models');
  const students = await Student.findAll();

  for (const student of students) {
    const activeStrikes = await Strike.count({
      where: {
        studentId: student.id,
        isExcused: false,
      },
    });

    const newStatus = calculateStudentStatus(activeStrikes);
    await student.update({
      strikeCount: activeStrikes,
      status: newStatus,
    });
  }
}

