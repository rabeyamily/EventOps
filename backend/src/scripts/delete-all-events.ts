import { sequelize } from '../database/connection';
import { Event } from '../models/Event';
import { Attendance } from '../models/Attendance';
import { Strike } from '../models/Strike';

async function deleteAllEvents() {
  try {
    console.log('🔄 Starting to delete all events...');
    
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

    // Delete all events
    console.log('🗑️  Deleting all events...');
    const eventCount = await Event.count();
    await Event.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${eventCount} events.`);

    console.log('✅ All events and related records deleted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting events:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  deleteAllEvents();
}

export default deleteAllEvents;
