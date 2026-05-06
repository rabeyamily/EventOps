import { sequelize } from '../database/connection';
import { DataTypes } from 'sequelize';

/**
 * Migration script to add createdByStaffId and updatedByStaffId columns to students table
 */
async function addStudentAuditFields() {
  try {
    console.log('🔄 Starting student audit fields migration...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    const queryInterface = sequelize.getQueryInterface();

    // Add createdByStaffId column
    try {
      await queryInterface.addColumn('students', 'createdByStaffId', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id',
        },
      });
      console.log('✅ Added createdByStaffId column');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  createdByStaffId column already exists');
      } else {
        throw err;
      }
    }

    // Add updatedByStaffId column
    try {
      await queryInterface.addColumn('students', 'updatedByStaffId', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id',
        },
      });
      console.log('✅ Added updatedByStaffId column');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  updatedByStaffId column already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Student audit fields migration completed successfully.');
    console.log('📝 Note: Future student creations and updates will track who created/updated them.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding student audit fields:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  addStudentAuditFields();
}

export default addStudentAuditFields;
