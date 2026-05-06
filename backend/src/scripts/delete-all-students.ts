import { sequelize } from '../database/connection';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { Strike } from '../models/Strike';

async function deleteAllStudents() {
  try {
    console.log('🔄 Starting to delete all students...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Delete related records first (due to foreign key constraints)
    console.log('🗑️  Deleting attendance records...');
    const attendanceCount = await Attendance.count();
    await Attendance.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${attendanceCount} attendance records.`);

    console.log('🗑️  Deleting strike records...');
    const strikeCount = await Strike.count();
    await Strike.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${strikeCount} strike records.`);

    // Delete all students
    console.log('🗑️  Deleting all students...');
    const studentCount = await Student.count();
    await Student.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${studentCount} students.`);

    console.log('✅ All students and related records deleted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting students:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  deleteAllStudents();
}

export default deleteAllStudents;
