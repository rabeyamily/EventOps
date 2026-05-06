import { sequelize } from '../database/connection';

/**
 * Migration script to update student table:
 * - Remove unique constraint on nyuEmail alone
 * - Add composite unique constraint on (nyuEmail, cohort)
 * This allows the same student (email) to exist for multiple semesters/cohorts
 */
async function updateStudentUniqueConstraint() {
  try {
    console.log('🔄 Starting student unique constraint migration...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    const queryInterface = sequelize.getQueryInterface();

    // Try to remove old unique constraint (might have different names)
    const indexNames = [
      'students_nyu_email_unique',
      'students_nyuEmail_unique',
      'nyuEmail',
    ];

    for (const indexName of indexNames) {
      try {
        await queryInterface.removeIndex('students', indexName);
        console.log(`✅ Removed old unique constraint: ${indexName}`);
        break;
      } catch (err: any) {
        // Index doesn't exist with this name, try next
        continue;
      }
    }

    // Add composite unique index on (nyuEmail, cohort)
    try {
      await queryInterface.addIndex('students', ['nyuEmail', 'cohort'], {
        unique: true,
        name: 'unique_email_cohort',
      });
      console.log('✅ Added composite unique constraint on (nyuEmail, cohort)');
    } catch (err: any) {
      // Index might already exist
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  Composite unique constraint already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Student unique constraint migration completed successfully.');
    console.log('📝 Note: Same email can now exist for different cohorts.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating student unique constraint:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateStudentUniqueConstraint();
}

export default updateStudentUniqueConstraint;
