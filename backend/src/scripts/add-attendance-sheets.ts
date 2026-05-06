import { sequelize } from '../database/connection';
import { QueryInterface, DataTypes } from 'sequelize';

async function addAttendanceSheets() {
  try {
    console.log('🔄 Starting attendance sheets migration...');
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    const queryInterface: QueryInterface = sequelize.getQueryInterface();

    // 1. Create attendance_sheets table
    const tableDescription = await queryInterface.describeTable('attendance_sheets').catch(() => null);
    if (!tableDescription) {
      console.log('📝 Creating attendance_sheets table...');
      await queryInterface.createTable('attendance_sheets', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        eventId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'events',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        busNumber: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdByStaffId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'staff',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Add indexes
      await queryInterface.addIndex('attendance_sheets', ['eventId'], { name: 'attendance_sheets_event_id' });
      await queryInterface.addIndex('attendance_sheets', ['busNumber'], { name: 'attendance_sheets_bus_number' });
      await queryInterface.addIndex('attendance_sheets', ['isActive'], { name: 'attendance_sheets_is_active' });
      await queryInterface.addIndex('attendance_sheets', ['createdByStaffId'], { name: 'attendance_sheets_created_by' });
      
      console.log('✅ Created attendance_sheets table.');
    } else {
      console.log('ℹ️  attendance_sheets table already exists');
    }

    // 2. Add attendanceSheetId column to attendances table
    const attendanceTableDescription = await queryInterface.describeTable('attendances');
    if (!attendanceTableDescription.attendanceSheetId) {
      console.log('📝 Adding attendanceSheetId column to attendances table...');
      await queryInterface.addColumn('attendances', 'attendanceSheetId', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'attendance_sheets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });

      // Add index
      await queryInterface.addIndex('attendances', ['attendanceSheetId'], { name: 'attendances_attendance_sheet_id' });
      
      console.log('✅ Added attendanceSheetId column to attendances table.');
    } else {
      console.log('ℹ️  attendanceSheetId column already exists');
    }

    // 3. Remove old unique constraint if it exists
    try {
      await queryInterface.removeConstraint('attendances', 'attendances_event_id_student_id_key');
    } catch (e) {
      // Constraint might not exist or have different name
      try {
        await queryInterface.removeConstraint('attendances', 'attendances_eventId_studentId_key');
      } catch (e2) {
        console.log('ℹ️  Old unique constraint not found or already removed');
      }
    }

    // Note: We don't add a new unique constraint because:
    // - Multiple attendance records per student per event are allowed (one per sheet)
    // - NULL attendanceSheetId values are allowed for backward compatibility
    // - The application logic ensures one record per student per sheet
    console.log('ℹ️  Multiple attendance records per student per event are now allowed (one per sheet)');

    console.log('✅ Attendance sheets migration completed successfully.');
    console.log('📝 Note: Multiple attendance sheets can now be created per event.');
  } catch (error) {
    console.error('❌ Error adding attendance sheets:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  addAttendanceSheets();
}

export default addAttendanceSheets;
