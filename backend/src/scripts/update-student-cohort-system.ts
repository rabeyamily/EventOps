import { sequelize } from '../database/connection';
import { DataTypes } from 'sequelize';

/**
 * Migration script to update student table for multi-cohort support:
 * - Remove composite unique constraint on (nyuEmail, cohort)
 * - Add back unique constraint on nyuEmail only (one student per email)
 * - Add primaryCohort column
 * This allows one student record to track multiple cohorts
 */
async function updateStudentCohortSystem() {
  try {
    console.log('🔄 Starting student cohort system migration...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    const queryInterface = sequelize.getQueryInterface();

    // Remove composite unique constraint
    try {
      await queryInterface.removeIndex('students', 'unique_email_cohort');
      console.log('✅ Removed composite unique constraint on (nyuEmail, cohort)');
    } catch (err: any) {
      console.log('ℹ️  Composite unique constraint may not exist');
    }

    // Add unique constraint back on email only
    try {
      await queryInterface.addIndex('students', ['nyuEmail'], {
        unique: true,
        name: 'students_nyu_email_unique',
      });
      console.log('✅ Added unique constraint on nyuEmail');
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Unique constraint on nyuEmail already exists');
      } else {
        throw err;
      }
    }

    // Add primaryCohort column if it doesn't exist
    try {
      await queryInterface.addColumn('students', 'primaryCohort', {
        type: DataTypes.STRING,
        allowNull: true,
      });
      console.log('✅ Added primaryCohort column');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  primaryCohort column already exists');
      } else {
        throw err;
      }
    }

    // Update existing students: set primaryCohort to their current cohort
    try {
      await sequelize.query(`
        UPDATE students 
        SET "primaryCohort" = "cohort" 
        WHERE "primaryCohort" IS NULL AND "cohort" IS NOT NULL
      `);
      console.log('✅ Updated existing students with primaryCohort');
    } catch (err: any) {
      console.log('ℹ️  Could not update primaryCohort for existing students:', err.message);
    }

    console.log('✅ Student cohort system migration completed successfully.');
    console.log('📝 Note: One student record per email, cohorts stored as comma-separated list.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating student cohort system:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateStudentCohortSystem();
}

export default updateStudentCohortSystem;
