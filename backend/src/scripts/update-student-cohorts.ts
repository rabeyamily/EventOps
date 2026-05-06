import { Student } from '../models/Student';
import { SystemSettings } from '../models/SystemSettings';
import { formatSemester } from '../utils/semester';
import { Semester } from '../models/Event';

/**
 * Update all students' cohorts to match the current semester setting
 * Run this after setting the current semester in admin settings
 */
async function updateStudentCohorts() {
  try {
    console.log('🔄 Starting cohort update...');
    
    // Get current semester from system settings, fall back to date-derived value
    const now = new Date();
    const nowMonth = now.getMonth() + 1;
    const nowYear = now.getFullYear();
    let cohort = nowMonth >= 8 && nowMonth <= 12
      ? formatSemester(Semester.FALL, nowYear)
      : formatSemester(Semester.SPRING, nowYear);
    try {
      const semesterSetting = await SystemSettings.findOne({ 
        where: { key: 'current_semester' } 
      });
      if (semesterSetting && semesterSetting.value) {
        cohort = semesterSetting.value;
        console.log(`📅 Using current semester: ${cohort}`);
      } else {
        console.log(`📅 No setting found, using auto-detected: ${cohort}`);
      }
    } catch (err) {
      console.error('Failed to fetch current semester, using date-derived value:', err);
    }

    // Update all students
    const [updatedCount] = await Student.update(
      { cohort },
      { where: {} }
    );

    console.log(`✅ Successfully updated ${updatedCount} students with cohort: ${cohort}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating student cohorts:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateStudentCohorts();
}

export { updateStudentCohorts };
